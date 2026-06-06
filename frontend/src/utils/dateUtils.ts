/**
 * Retorna a data atual no fuso horário de Brasília (America/Sao_Paulo)
 * no formato YYYY-MM-DD — correto mesmo às 23h quando UTC já é outro dia.
 */
export function todayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Retorna o mês atual no fuso horário de Brasília no formato YYYY-MM.
 */
export function currentMonthBR(): string {
  return todayBR().slice(0, 7)
}
