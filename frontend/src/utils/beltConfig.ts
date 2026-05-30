import { Belt } from '../api/client'

export const BELT_PT: Record<Belt, string> = {
  white: 'Branca',
  grey_white: 'Cinza e Branca', grey: 'Cinza', grey_black: 'Cinza e Preta',
  yellow_white: 'Amarela e Branca', yellow: 'Amarela', yellow_black: 'Amarela e Preta',
  orange_white: 'Laranja e Branca', orange: 'Laranja', orange_black: 'Laranja e Preta',
  green_white: 'Verde e Branca', green: 'Verde', green_black: 'Verde e Preta',
  blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta',
}

export const BELT_BG: Record<Belt, string> = {
  white: 'bg-gray-100 text-gray-700',
  grey_white: 'bg-gray-200 text-gray-700', grey: 'bg-gray-300 text-gray-800', grey_black: 'bg-gray-400 text-gray-900',
  yellow_white: 'bg-yellow-50 text-yellow-800', yellow: 'bg-yellow-100 text-yellow-800', yellow_black: 'bg-yellow-200 text-yellow-900',
  orange_white: 'bg-orange-50 text-orange-800', orange: 'bg-orange-100 text-orange-800', orange_black: 'bg-orange-200 text-orange-900',
  green_white: 'bg-green-50 text-green-800', green: 'bg-green-100 text-green-800', green_black: 'bg-green-200 text-green-900',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  brown: 'bg-amber-100 text-amber-800',
  black: 'bg-gray-800 text-white',
}

export const BELT_BG_SOLID: Record<Belt, string> = {
  white: 'bg-gray-200 text-gray-800',
  grey_white: 'bg-gray-300 text-gray-800', grey: 'bg-gray-400 text-white', grey_black: 'bg-gray-600 text-white',
  yellow_white: 'bg-yellow-300 text-gray-900', yellow: 'bg-yellow-400 text-gray-900', yellow_black: 'bg-yellow-500 text-gray-900',
  orange_white: 'bg-orange-300 text-white', orange: 'bg-orange-500 text-white', orange_black: 'bg-orange-600 text-white',
  green_white: 'bg-green-300 text-white', green: 'bg-green-500 text-white', green_black: 'bg-green-700 text-white',
  blue: 'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white',
  brown: 'bg-amber-800 text-white',
  black: 'bg-gray-900 text-white',
}

export const BELT_STRIPE: Record<Belt, string> = {
  white: 'bg-gray-400',
  grey_white: 'bg-gray-500', grey: 'bg-gray-600', grey_black: 'bg-gray-700',
  yellow_white: 'bg-yellow-500', yellow: 'bg-yellow-600', yellow_black: 'bg-yellow-700',
  orange_white: 'bg-orange-500', orange: 'bg-orange-600', orange_black: 'bg-orange-700',
  green_white: 'bg-green-500', green: 'bg-green-700', green_black: 'bg-green-800',
  blue: 'bg-blue-800', purple: 'bg-purple-800', brown: 'bg-amber-900', black: 'bg-white',
}

export const BELTS_ADULTO: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']
export const BELTS_INFANTIL: Belt[] = [
  'white',
  'grey_white', 'grey', 'grey_black',
  'yellow_white', 'yellow', 'yellow_black',
  'orange_white', 'orange', 'orange_black',
  'green_white', 'green', 'green_black',
]
export const ALL_BELTS: Belt[] = [
  'white',
  'grey_white', 'grey', 'grey_black',
  'yellow_white', 'yellow', 'yellow_black',
  'orange_white', 'orange', 'orange_black',
  'green_white', 'green', 'green_black',
  'blue', 'purple', 'brown', 'black',
]
