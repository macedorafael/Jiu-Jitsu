"""
Face recognition service using DeepFace + OpenCV.
Detection: OpenCV Haar Cascade (direto, sem DeepFace wrapper).
Encoding/matching: DeepFace FaceNet.
"""
import io
import logging
import uuid
import os
import numpy as np
from typing import Optional
from PIL import Image

logger = logging.getLogger(__name__)

MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.4"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


def _load_image_from_bytes(data: bytes) -> np.ndarray:
    """Carrega imagem de bytes como array RGB."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(img)


def _iou(a: list, b: list) -> float:
    """Intersection over Union entre dois retângulos [x,y,w,h]."""
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _nms(boxes: list, iou_threshold: float = 0.35) -> list:
    """Non-Maximum Suppression simples para remover caixas duplicadas."""
    if not boxes:
        return []
    # Ordena por área decrescente
    boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    kept = []
    while boxes:
        best = boxes.pop(0)
        kept.append(best)
        boxes = [b for b in boxes if _iou(best, b) < iou_threshold]
    return kept


def detect_and_crop_faces(image_bytes: bytes) -> list[tuple[np.ndarray, dict]]:
    """
    Detecta rostos usando DeepFace (backends precisos) com fallback para Haar Cascade.

    Ordem de tentativa:
      1. retinaface  — mais preciso, sem falsos positivos, retorna confidence
      2. mtcnn       — preciso, retorna confidence
      3. opencv      — fallback (Haar interno do DeepFace, conservador)

    Haar Cascade manual foi removido pois gera muitos falsos positivos em fotos
    de grupo com fundos complexos.
    """
    try:
        from deepface import DeepFace
        import cv2

        img_rgb = _load_image_from_bytes(image_bytes)
        h_orig, w_orig = img_rgb.shape[:2]

        # Reduz para no máximo 1200px para acelerar detecção sem perder rostos
        MAX_WIDTH = 1200
        scale = min(1.0, MAX_WIDTH / w_orig)
        if scale < 1.0:
            detect_w = int(w_orig * scale)
            detect_h = int(h_orig * scale)
            img_detect = cv2.resize(img_rgb, (detect_w, detect_h))
        else:
            img_detect = img_rgb
            scale = 1.0
            detect_w, detect_h = w_orig, h_orig

        extracted = None
        used_backend = None

        # Tenta backends em ordem de precisão
        for backend in ["retinaface", "mtcnn", "opencv"]:
            try:
                result = DeepFace.extract_faces(
                    img_path=img_detect,
                    detector_backend=backend,
                    enforce_detection=False,
                    align=False,
                )
                if result:
                    extracted = result
                    used_backend = backend
                    logger.info("Detector '%s' encontrou %d rosto(s)", backend, len(result))
                    break
            except Exception as exc:
                logger.debug("Backend '%s' indisponível: %s", backend, exc)

        if not extracted:
            logger.info("Nenhum rosto detectado na imagem %dx%d", w_orig, h_orig)
            return []

        # Limiar de confiança — retinaface/mtcnn retornam 0–1; opencv retorna 0
        CONFIDENCE_THRESHOLD = 0.85

        results = []
        for face_data in extracted:
            confidence = face_data.get("confidence", 0.0)

            # Para backends com confiança real, descarta detecções fracas
            if used_backend in ("retinaface", "mtcnn") and confidence < CONFIDENCE_THRESHOLD:
                logger.debug("Descartando rosto com confiança %.2f < %.2f", confidence, CONFIDENCE_THRESHOLD)
                continue

            area = face_data.get("facial_area", {})
            x = int(area.get("x", 0))
            y = int(area.get("y", 0))
            w = int(area.get("w", 0))
            h = int(area.get("h", 0))

            if w == 0 or h == 0:
                continue

            # Converte coordenadas de detect_img → imagem original
            x0 = int(x / scale)
            y0 = int(y / scale)
            w0 = int(w / scale)
            h0 = int(h / scale)

            # Padding 20% para incluir testa/queixo
            pad_x = int(w0 * 0.20)
            pad_y = int(h0 * 0.20)
            x1 = max(0, x0 - pad_x)
            y1 = max(0, y0 - pad_y)
            x2 = min(w_orig, x0 + w0 + pad_x)
            y2 = min(h_orig, y0 + h0 + pad_y)

            face_crop = img_rgb[y1:y2, x1:x2]
            if face_crop.size == 0:
                continue

            region = {"x": x0, "y": y0, "w": w0, "h": h0}
            results.append((face_crop, region))

        logger.info(
            "Detecção final: %d rosto(s) após filtro de confiança (backend=%s, imagem %dx%d)",
            len(results), used_backend, w_orig, h_orig,
        )
        return results

    except Exception as e:
        logger.error("detect_and_crop_faces falhou: %s", e, exc_info=True)
        return []


def encode_face_from_bytes(image_bytes: bytes) -> Optional[list[float]]:
    """
    Extrai encoding de uma foto de referência (foto do aluno).
    Tenta múltiplos backends em ordem de precisão.
    Retorna None se nenhum rosto for encontrado.
    """
    try:
        from deepface import DeepFace
        import cv2

        img_array = _load_image_from_bytes(image_bytes)

        # Redimensiona se necessário (mínimo 160px para FaceNet)
        MIN_SIZE = 160
        h, w = img_array.shape[:2]
        if h < MIN_SIZE or w < MIN_SIZE:
            scale = max(MIN_SIZE / h, MIN_SIZE / w)
            img_array = cv2.resize(img_array, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        # Tenta backends em ordem de precisão
        for backend in ["retinaface", "mtcnn", "opencv"]:
            try:
                result = DeepFace.represent(
                    img_path=img_array,
                    model_name="Facenet",
                    enforce_detection=True,
                    detector_backend=backend,
                )
                if result and result[0].get("embedding"):
                    logger.info("encode_face_from_bytes: rosto encontrado com backend '%s'", backend)
                    return result[0]["embedding"]
            except Exception as exc:
                logger.debug("Backend '%s' falhou: %s", backend, exc)

        logger.warning("encode_face_from_bytes: nenhum rosto detectado com nenhum backend")
        return None
    except Exception as e:
        logger.error("encode_face_from_bytes falhou: %s", e, exc_info=False)
        return None


def get_face_encoding(face_array: np.ndarray) -> Optional[list[float]]:
    """Gera encoding de um recorte de rosto já isolado.
    Redimensiona para mínimo 160x160 — requisito do FaceNet."""
    try:
        import cv2
        from deepface import DeepFace

        # FaceNet precisa de pelo menos 160x160
        MIN_SIZE = 160
        h, w = face_array.shape[:2]
        if h < MIN_SIZE or w < MIN_SIZE:
            scale = max(MIN_SIZE / h, MIN_SIZE / w)
            new_w = max(MIN_SIZE, int(w * scale))
            new_h = max(MIN_SIZE, int(h * scale))
            face_array = cv2.resize(face_array, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            logger.debug("Rosto redimensionado de %dx%d para %dx%d", w, h, new_w, new_h)

        result = DeepFace.represent(
            img_path=face_array,
            model_name="Facenet",
            enforce_detection=False,
            detector_backend="skip",
        )
        if result:
            return result[0]["embedding"]
        return None
    except Exception as e:
        logger.error("get_face_encoding falhou: %s", e, exc_info=False)
        return None


def encode_face_from_crop_bytes(image_bytes: bytes) -> Optional[list[float]]:
    """Gera encoding a partir de bytes de um recorte de rosto já salvo."""
    try:
        img_array = _load_image_from_bytes(image_bytes)
        return get_face_encoding(img_array)
    except Exception as e:
        logger.warning("encode_face_from_crop_bytes falhou: %s", e)
        return None


def cosine_distance(a: list[float], b: list[float]) -> float:
    va = np.array(a)
    vb = np.array(b)
    return 1 - np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-10)


def match_face(
    face_encoding: list[float],
    students_encodings: list[tuple[int, list[float]]],
) -> Optional[tuple[int, float]]:
    """
    Compara encoding contra todos os alunos cadastrados.
    Retorna (student_id, confidence_score) ou None.
    """
    best_id = None
    best_dist = float("inf")

    for student_id, encoding in students_encodings:
        dist = cosine_distance(face_encoding, encoding)
        if dist < best_dist:
            best_dist = dist
            best_id = student_id

    if best_id is not None and best_dist < MATCH_THRESHOLD:
        confidence = round(1 - best_dist, 4)
        return best_id, confidence
    return None


def save_face_crop(face_array: np.ndarray, session_ref) -> str:
    """Salva recorte de rosto em disco e retorna o caminho."""
    import cv2
    faces_dir = os.path.join(UPLOAD_DIR, "faces")
    os.makedirs(faces_dir, exist_ok=True)
    filename = f"session_{session_ref}_{uuid.uuid4()}.jpg"
    path = os.path.join(faces_dir, filename)
    bgr = cv2.cvtColor(face_array, cv2.COLOR_RGB2BGR)
    cv2.imwrite(path, bgr)
    return path
