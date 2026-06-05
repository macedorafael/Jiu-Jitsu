import { useState } from 'react'
import {
  HelpCircle, Users, Camera, DollarSign, TrendingUp, Settings,
  UserCog, Building2, Clock, ClipboardList, User, KeyRound,
  ChevronDown, ChevronRight, CheckCircle, Award, BarChart2,
  Search, AlertTriangle, Image, Eye,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Role } from '../../api/client'

interface Step { text: string }
interface HelpItem {
  title: string
  description: string
  steps?: Step[]
  tips?: string[]
  roles: Role[]
}
interface HelpSection {
  id: string
  icon: any
  color: string
  title: string
  subtitle: string
  roles: Role[]
  items: HelpItem[]
}

const SECTIONS: HelpSection[] = [
  // ── ALUNOS ──────────────────────────────────────────────────────────────────
  {
    id: 'alunos', icon: Users, color: 'bg-blue-500', title: 'Alunos', subtitle: 'Cadastro e gestão de alunos',
    roles: ['root', 'admin', 'admin_especifico', 'professor'],
    items: [
      {
        title: 'Cadastrar novo aluno', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Adiciona um novo aluno ao sistema criando também uma conta de acesso para ele.',
        steps: [
          { text: 'Acesse o menu Alunos' },
          { text: 'Clique no botão "+ Novo Aluno"' },
          { text: 'Preencha o perfil (Adulto ou Infantil), nome, e-mail, faixa, grau, data de nascimento e telefone' },
          { text: 'O sistema criará automaticamente uma conta com a senha padrão "aluno123"' },
          { text: 'O aluno deverá alterar a senha no primeiro login' },
        ],
        tips: ['O e-mail é usado para o aluno fazer login', 'Para admin específico, o perfil é fixo conforme seu acesso'],
      },
      {
        title: 'Cadastrar foto para reconhecimento facial', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'A foto é usada para identificar o aluno automaticamente na chamada por foto de treino.',
        steps: [
          { text: 'Na lista de alunos, clique no aluno desejado' },
          { text: 'Clique no ícone de câmera na foto do aluno' },
          { text: 'Selecione uma foto com o rosto bem visível e iluminado' },
          { text: 'Aguarde o processamento — o sistema detecta e codifica o rosto automaticamente' },
        ],
        tips: ['Use fotos com rosto frontal, bem iluminado', 'Evite fotos com óculos escuros ou boné cobrindo o rosto'],
      },
      {
        title: 'Editar dados do aluno', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Atualiza informações cadastrais como nome, faixa, grau, telefone e data de matrícula.',
        steps: [
          { text: 'Na lista de alunos, clique no ícone de lápis ao lado do aluno' },
          { text: 'Altere os campos desejados' },
          { text: 'Clique em "Salvar"' },
        ],
      },
      {
        title: 'Pausar / Reativar aluno', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Alunos pausados não aparecem nas listas ativas e têm o acesso ao sistema desativado.',
        steps: [
          { text: 'Abra o detalhe do aluno (clique no nome)' },
          { text: 'Clique em "Pausar aluno" ou "Reativar aluno"' },
          { text: 'Informe uma observação opcional (ex: lesão, viagem)' },
          { text: 'Confirme a ação' },
        ],
      },
      {
        title: 'Promover faixa/grau', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Registra a graduação do aluno, atualizando a faixa e o grau no histórico.',
        steps: [
          { text: 'Abra o detalhe do aluno' },
          { text: 'Clique em "Promover faixa"' },
          { text: 'Selecione a nova faixa, grau e a data de graduação' },
          { text: 'Adicione observações e/ou anexe o certificado (opcional)' },
          { text: 'Clique em "Promover"' },
        ],
        tips: ['O histórico completo de faixas fica disponível na aba "Faixas" do detalhe do aluno'],
      },
      {
        title: 'Ver progresso de graduação', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Acompanha quantas presenças cada aluno acumulou desde a última graduação em relação à meta.',
        steps: [
          { text: 'Acesse o menu Presenças' },
          { text: 'Clique na aba "Evolução"' },
          { text: 'Filtre por perfil (Todos / Adulto / Infantil) se necessário' },
          { text: 'Cada card mostra a barra de progresso, contagem de presenças e requisito de idade' },
        ],
        tips: ['A meta de presenças é configurada em Configurações → Graduação'],
      },
    ],
  },

  // ── CHAMADA ──────────────────────────────────────────────────────────────────
  {
    id: 'chamada', icon: Camera, color: 'bg-purple-500', title: 'Chamada por foto', subtitle: 'Registro automático de presença',
    roles: ['admin', 'admin_especifico', 'professor'],
    items: [
      {
        title: 'Fazer chamada por foto de treino', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Envia uma foto do grupo de treino e o sistema identifica automaticamente os alunos presentes.',
        steps: [
          { text: 'Acesse o menu Chamada' },
          { text: 'Selecione o horário da aula ou informe um horário livre' },
          { text: 'Escolha a data e adicione observações se necessário' },
          { text: 'Clique em "Selecionar foto" e escolha a foto do treino' },
          { text: 'Clique em "Processar chamada"' },
          { text: 'Revise os alunos reconhecidos automaticamente' },
          { text: 'Para rostos não identificados, clique neles para vincular ao aluno correto' },
          { text: 'Confirme a chamada para salvar as presenças' },
        ],
        tips: [
          'Fotos com boa iluminação melhoram muito a precisão',
          'O sistema tenta identificar usando 3 algoritmos diferentes (RetinaFace, MTCNN, OpenCV)',
          'Rostos não identificados podem ser vinculados manualmente após o processamento',
        ],
      },
      {
        title: 'Checkbox "Melhorar reconhecimento"', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Aparece quando você corrige uma identificação errada ou identifica um rosto desconhecido. Quando marcado, o sistema aprende com aquele rosto e melhora o reconhecimento futuro daquele aluno.',
        steps: [
          { text: 'O checkbox aparece apenas em dois momentos: quando você corrige quem o sistema identificou errado, ou quando você identifica manualmente um rosto que o sistema não reconheceu' },
          { text: 'Por padrão vem MARCADO — basta confirmar normalmente e o sistema aprende sozinho' },
          { text: 'Se quiser desmarcar, clique no checkbox antes de confirmar a chamada' },
        ],
        tips: [
          '✅ MARQUE quando: o rosto está bem iluminado, de frente e nítido — o sistema vai reconhecer melhor nas próximas chamadas',
          '✅ MARQUE quando: o aluno mudou o visual (cortou o cabelo, cresceu barba) e está sendo reconhecido com dificuldade',
          '❌ DESMARQUE quando: a foto está escura, desfocada ou o rosto está de lado — um encoding ruim piora o reconhecimento futuro',
          '❌ DESMARQUE quando: o aluno está usando chapéu, óculos escuros ou algo que cubra parte do rosto',
          '❌ DESMARQUE quando: você identificou o aluno mas não tem certeza se o rosto recortado é realmente aquela pessoa',
          'Dica: na dúvida, deixe marcado. Fotos tiradas no treino com boa iluminação tendem a ser melhores que a foto de perfil cadastrada',
        ],
      },
      {
        title: 'Criar chamada manual (sem foto)', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Cria uma sessão de treino e adiciona alunos manualmente, sem usar reconhecimento facial.',
        steps: [
          { text: 'Acesse o menu Chamada' },
          { text: 'Clique em "Chamada manual"' },
          { text: 'Selecione o horário/data' },
          { text: 'Adicione os alunos presentes um por um' },
        ],
      },
      {
        title: 'Corrigir presença em sessão já salva', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Permite adicionar, remover ou corrigir alunos em sessões de treino já registradas.',
        steps: [
          { text: 'Acesse o menu Presenças' },
          { text: 'Encontre a sessão desejada e clique nela para expandir' },
          { text: 'Para adicionar: use o campo de busca e clique em "+"' },
          { text: 'Para remover: clique no "×" ao lado do aluno' },
          { text: 'Para trocar: clique no nome do aluno e selecione o correto' },
        ],
      },
    ],
  },

  // ── PRESENÇAS / HISTÓRICO ─────────────────────────────────────────────────────
  {
    id: 'presencas', icon: ClipboardList, color: 'bg-green-500', title: 'Presenças', subtitle: 'Histórico e acompanhamento',
    roles: ['admin', 'admin_especifico', 'professor'],
    items: [
      {
        title: 'Ver histórico de sessões', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Lista todas as sessões de treino com data, horário e alunos presentes.',
        steps: [
          { text: 'Acesse o menu Presenças' },
          { text: 'A aba "Sessões" mostra todas as aulas registradas' },
          { text: 'Clique em uma sessão para ver os detalhes e os alunos presentes' },
          { text: 'Use a busca para filtrar por nome de aluno' },
        ],
      },
      {
        title: 'Ver resumo de presenças por aluno', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Mostra um ranking dos alunos com maior número de presenças no período selecionado.',
        steps: [
          { text: 'Acesse o menu Presenças → aba "Resumo"' },
          { text: 'Selecione o período (data inicial e final)' },
          { text: 'Clique em "Filtrar"' },
        ],
      },
      {
        title: 'Acompanhar evolução para graduação', roles: ['admin', 'admin_especifico', 'professor'],
        description: 'Visualiza o progresso de cada aluno em relação à meta de presenças para a próxima faixa.',
        steps: [
          { text: 'Acesse o menu Presenças → aba "Evolução"' },
          { text: 'Cada card mostra: foto, faixa atual, próxima faixa, barra de progresso e indicador de idade' },
          { text: 'O ícone ✓ verde indica que o aluno já tem a idade mínima para graduar' },
          { text: 'O ícone ✗ laranja indica que o aluno ainda não atingiu a idade mínima' },
        ],
        tips: ['A meta de presenças é definida em Configurações da escola'],
      },
    ],
  },

  // ── MENSALIDADES ──────────────────────────────────────────────────────────────
  {
    id: 'mensalidades', icon: DollarSign, color: 'bg-emerald-500', title: 'Mensalidades', subtitle: 'Planos e pagamentos',
    roles: ['admin', 'admin_especifico'],
    items: [
      {
        title: 'Criar plano de mensalidade', roles: ['admin', 'admin_especifico'],
        description: 'Define o valor, dia de vencimento e método de pagamento para um aluno.',
        steps: [
          { text: 'Acesse o menu Mensalidades' },
          { text: 'Selecione o aluno na lista à esquerda' },
          { text: 'Clique em "Criar plano"' },
          { text: 'Informe o valor mensal, dia de vencimento (1–31) e forma de pagamento' },
          { text: 'Clique em "Salvar"' },
        ],
        tips: ['O plano também pode ser criado no momento do cadastro do aluno'],
      },
      {
        title: 'Registrar pagamento', roles: ['admin', 'admin_especifico'],
        description: 'Marca o pagamento de um mês como realizado para um aluno específico.',
        steps: [
          { text: 'Acesse o menu Mensalidades' },
          { text: 'Selecione o aluno' },
          { text: 'Clique em "+ Registrar"' },
          { text: 'Confirme o mês de referência e o valor pago' },
          { text: 'Clique em "Confirmar pagamento"' },
        ],
        tips: ['Se o registro já existia como pendente/atraso, ele será atualizado automaticamente para pago'],
      },
      {
        title: 'Ver alunos com pagamento pendente ou em atraso', roles: ['admin', 'admin_especifico'],
        description: 'Filtra apenas os alunos que ainda não pagaram o mês atual.',
        steps: [
          { text: 'Acesse o menu Mensalidades' },
          { text: 'Clique no botão "Pendentes / Atraso"' },
          { text: 'A lista mostrará somente alunos com pagamento em aberto' },
          { text: 'Clique em um aluno — o formulário de pagamento abre e a tela rola automaticamente' },
        ],
        tips: [
          'Pendente: ainda dentro do prazo de vencimento',
          'Em atraso: passou do dia de vencimento sem pagar',
        ],
      },
    ],
  },

  // ── FINANCEIRO ────────────────────────────────────────────────────────────────
  {
    id: 'financeiro', icon: TrendingUp, color: 'bg-yellow-500', title: 'Financeiro', subtitle: 'Relatórios e indicadores',
    roles: ['admin', 'admin_especifico'],
    items: [
      {
        title: 'Ver resumo financeiro do mês', roles: ['admin', 'admin_especifico'],
        description: 'Exibe o total arrecadado, pendente e em atraso no mês atual e histórico mensal.',
        steps: [
          { text: 'Acesse o menu Financeiro' },
          { text: 'O painel superior mostra os totais do mês atual' },
          { text: 'O gráfico abaixo exibe o histórico dos últimos meses' },
        ],
      },
      {
        title: 'Ver lista de pagamentos', roles: ['admin', 'admin_especifico'],
        description: 'Lista todos os pagamentos com filtros por mês, status e perfil de aluno.',
        steps: [
          { text: 'Acesse o menu Financeiro' },
          { text: 'Role a página para a seção de pagamentos' },
          { text: 'Use os filtros de mês e status para refinar a busca' },
        ],
      },
    ],
  },

  // ── HORÁRIOS ──────────────────────────────────────────────────────────────────
  {
    id: 'horarios', icon: Clock, color: 'bg-orange-500', title: 'Horários', subtitle: 'Grade de aulas',
    roles: ['admin', 'admin_especifico'],
    items: [
      {
        title: 'Cadastrar horário de aula', roles: ['admin', 'admin_especifico'],
        description: 'Adiciona um horário fixo à grade de aulas da academia (ex: Segunda 19h–20h30).',
        steps: [
          { text: 'Acesse o menu Horários' },
          { text: 'Clique em "+ Novo horário"' },
          { text: 'Selecione o dia da semana, horário de início e de término' },
          { text: 'Clique em "Salvar"' },
        ],
        tips: ['Os horários cadastrados aparecem como opção na criação de chamadas'],
      },
    ],
  },

  // ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
  {
    id: 'configuracoes', icon: Settings, color: 'bg-gray-500', title: 'Configurações', subtitle: 'Parâmetros da escola',
    roles: ['admin'],
    items: [
      {
        title: 'Definir meta de presenças por faixa', roles: ['admin'],
        description: 'Configura quantas presenças são necessárias para o aluno ser elegível para a próxima graduação.',
        steps: [
          { text: 'Acesse o menu Configurações' },
          { text: 'Na seção "Graduação — Presenças Mínimas", preencha os valores para cada faixa:' },
          { text: 'Faixas Coloridas (infantil: branca→verde), Faixa Azul, Faixa Roxa, Faixa Marrom, Faixa Preta' },
          { text: 'Clique em "Salvar presenças"' },
        ],
        tips: ['Adultos nas faixas verdes (verde e branca, verde, verde e preta) usam a meta de Faixas Coloridas'],
      },
      {
        title: 'Configurar chave Pix', roles: ['admin'],
        description: 'Cadastra a chave Pix da academia para gerar QR Code automático no painel do aluno.',
        steps: [
          { text: 'Acesse o menu Configurações' },
          { text: 'Na seção "Pix", informe a chave Pix (CPF, CNPJ, e-mail, telefone ou chave aleatória)' },
          { text: 'Clique em "Salvar Pix"' },
        ],
        tips: ['O QR Code é gerado automaticamente e exibido no painel do aluno ao acessar a mensalidade'],
      },
    ],
  },

  // ── USUÁRIOS ──────────────────────────────────────────────────────────────────
  {
    id: 'usuarios', icon: UserCog, color: 'bg-rose-500', title: 'Usuários', subtitle: 'Gerenciamento de acesso',
    roles: ['root', 'admin'],
    items: [
      {
        title: 'Criar novo usuário', roles: ['root', 'admin'],
        description: 'Adiciona um usuário com perfil de Administrador, Admin Específico ou Professor.',
        steps: [
          { text: 'Acesse o menu Usuários' },
          { text: 'Clique em "+ Novo usuário"' },
          { text: 'Informe nome, e-mail, senha e função' },
          { text: 'Para Admin Específico, defina também se o acesso é para perfil Adulto ou Infantil' },
          { text: 'Clique em "Salvar"' },
        ],
        tips: [
          'Admin: acesso total à escola (alunos, presença, mensalidades, configurações)',
          'Admin Específico: acesso restrito a um perfil (adulto ou infantil)',
          'Professor: acesso a alunos e chamada, sem mensalidades',
        ],
      },
      {
        title: 'Desativar / reativar usuário', roles: ['root', 'admin'],
        description: 'Bloqueia ou restaura o acesso de um usuário ao sistema.',
        steps: [
          { text: 'Acesse o menu Usuários' },
          { text: 'Clique no ícone de edição ao lado do usuário' },
          { text: 'Altere o status ativo/inativo' },
          { text: 'Salve as alterações' },
        ],
      },
    ],
  },

  // ── ESCOLAS ───────────────────────────────────────────────────────────────────
  {
    id: 'escolas', icon: Building2, color: 'bg-indigo-500', title: 'Escolas', subtitle: 'Gestão de unidades',
    roles: ['root'],
    items: [
      {
        title: 'Cadastrar nova escola', roles: ['root'],
        description: 'Cria uma nova unidade/escola no sistema.',
        steps: [
          { text: 'Acesse o menu Escolas' },
          { text: 'Clique em "+ Nova escola"' },
          { text: 'Informe o nome da escola, telefone e chave Pix (opcional)' },
          { text: 'Clique em "Salvar"' },
        ],
      },
    ],
  },

  // ── MEU PERFIL (aluno) ────────────────────────────────────────────────────────
  {
    id: 'meu-perfil', icon: User, color: 'bg-teal-500', title: 'Meu Perfil', subtitle: 'Informações pessoais e progresso',
    roles: ['aluno'],
    items: [
      {
        title: 'Ver minhas presenças', roles: ['aluno'],
        description: 'Exibe todas as aulas que você participou, com data e horário.',
        steps: [
          { text: 'Acesse o menu Meu Perfil' },
          { text: 'A seção "Minhas Presenças" lista todas as suas presenças em ordem decrescente' },
        ],
      },
      {
        title: 'Ver meu progresso para a próxima faixa', roles: ['aluno'],
        description: 'Mostra quantas presenças você já acumulou desde a última graduação e qual é a meta.',
        steps: [
          { text: 'Acesse o menu Meu Perfil' },
          { text: 'O card "Progresso para próxima faixa" exibe a barra de progresso' },
          { text: 'O indicador de idade mostra se você já atingiu a idade mínima exigida' },
        ],
      },
      {
        title: 'Ver minha mensalidade', roles: ['aluno'],
        description: 'Exibe o status do pagamento do mês atual e o QR Code Pix para pagamento.',
        steps: [
          { text: 'Acesse o menu Meu Perfil' },
          { text: 'O card de mensalidade mostra se está pago, pendente ou em atraso' },
          { text: 'Se houver Pix configurado, o QR Code aparece para facilitar o pagamento' },
        ],
      },
      {
        title: 'Ver histórico de faixas', roles: ['aluno'],
        description: 'Lista todas as suas graduações com data e certificado (quando disponível).',
        steps: [
          { text: 'Acesse o menu Meu Perfil' },
          { text: 'Role até a seção "Histórico de Faixas"' },
        ],
      },
    ],
  },

  // ── SENHA ─────────────────────────────────────────────────────────────────────
  {
    id: 'senha', icon: KeyRound, color: 'bg-slate-500', title: 'Alterar Senha', subtitle: 'Segurança da conta',
    roles: ['root', 'admin', 'admin_especifico', 'professor', 'aluno'],
    items: [
      {
        title: 'Alterar minha senha', roles: ['root', 'admin', 'admin_especifico', 'professor', 'aluno'],
        description: 'Troca a senha de acesso ao sistema.',
        steps: [
          { text: 'No menu lateral, clique em "Alterar senha" (rodapé da sidebar)' },
          { text: 'Informe a senha atual' },
          { text: 'Informe a nova senha (mínimo 6 caracteres)' },
          { text: 'Confirme a nova senha' },
          { text: 'Clique em "Alterar senha"' },
        ],
        tips: ['Alunos com a senha padrão "aluno123" serão solicitados a trocar no primeiro login'],
      },
    ],
  },
]

// ── SectionCard ─────────────────────────────────────────────────────────────────
function SectionCard({ section }: { section: HelpSection }) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  function toggle(i: number) {
    setOpenItems((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const Icon = section.icon

  return (
    <div className="card overflow-hidden p-0">
      {/* Header da seção */}
      <div className={`flex items-center gap-3 px-5 py-4 ${section.color}`}>
        <Icon size={20} className="text-white flex-shrink-0" />
        <div>
          <h2 className="text-white font-bold text-base leading-tight">{section.title}</h2>
          <p className="text-white/70 text-xs">{section.subtitle}</p>
        </div>
        <span className="ml-auto text-white/60 text-xs font-medium">{section.items.length} função{section.items.length !== 1 ? 'ões' : ''}</span>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {section.items.map((item, i) => {
          const isOpen = openItems.has(i)
          return (
            <div key={i}>
              <button
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                onClick={() => toggle(i)}
              >
                <span className="text-sm font-medium text-gray-800">{item.title}</span>
                {isOpen
                  ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
                }
              </button>

              {isOpen && (
                <div className="px-5 pb-4 space-y-3 bg-gray-50">
                  <p className="text-sm text-gray-600">{item.description}</p>

                  {item.steps && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Passo a passo</p>
                      <ol className="space-y-1.5">
                        {item.steps.map((s, si) => (
                          <li key={si} className="flex items-start gap-2.5 text-sm text-gray-700">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                              {si + 1}
                            </span>
                            {s.text}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {item.tips && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                        <HelpCircle size={12} /> Dicas
                      </p>
                      {item.tips.map((t, ti) => (
                        <p key={ti} className="text-xs text-blue-700">• {t}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const role = user?.role as Role

  // Filtra seções e itens pelo papel do usuário e pela busca
  const visibleSections = SECTIONS
    .filter((s) => s.roles.includes(role))
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => {
        const matchRole = item.roles.includes(role)
        const matchSearch = search.trim() === '' ||
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase())
        return matchRole && matchSearch
      }),
    }))
    .filter((s) => s.items.length > 0)

  const totalFunctions = visibleSections.reduce((acc, s) => acc + s.items.length, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0">
          <HelpCircle size={24} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Central de Ajuda</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalFunctions} função{totalFunctions !== 1 ? 'ões' : ''} disponível{totalFunctions !== 1 ? 'eis' : ''} para o seu perfil
            <span className="ml-1 font-medium text-primary-600">
              ({user?.name})
            </span>
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar função ou funcionalidade..."
          className="input pl-9 py-2.5"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Seções */}
      {visibleSections.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
          <p>Nenhuma função encontrada para "{search}"</p>
        </div>
      ) : (
        visibleSections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))
      )}
    </div>
  )
}
