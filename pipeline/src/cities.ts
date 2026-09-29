export type MetroCluster = {
  metro: string
  state: string
  cities: string[]
}

export const METRO_CLUSTERS: MetroCluster[] = [
  // California — Central Valley
  { metro: 'Tracy-Stockton',  state: 'CA', cities: ['Tracy', 'Stockton', 'Lathrop', 'Manteca', 'Ripon'] },
  { metro: 'Modesto',         state: 'CA', cities: ['Modesto', 'Turlock', 'Ceres', 'Riverbank', 'Oakdale'] },
  { metro: 'Fresno',          state: 'CA', cities: ['Fresno', 'Clovis', 'Madera', 'Tulare', 'Visalia'] },
  { metro: 'Sacramento',      state: 'CA', cities: ['Sacramento', 'Elk Grove', 'Roseville', 'Folsom', 'Rancho Cordova'] },
  // California — Bay Area
  { metro: 'San Jose',        state: 'CA', cities: ['San Jose', 'Santa Clara', 'Sunnyvale', 'Milpitas', 'Campbell'] },
  { metro: 'East Bay',        state: 'CA', cities: ['Oakland', 'Fremont', 'Hayward', 'Concord', 'Antioch'] },
  // California — SoCal
  { metro: 'Inland Empire',   state: 'CA', cities: ['Riverside', 'San Bernardino', 'Ontario', 'Fontana', 'Rancho Cucamonga'] },
  { metro: 'San Diego',       state: 'CA', cities: ['San Diego', 'Chula Vista', 'El Cajon', 'Escondido', 'Vista'] },
  // Texas
  { metro: 'Dallas suburbs',  state: 'TX', cities: ['Plano', 'Garland', 'Irving', 'Frisco', 'McKinney'] },
  { metro: 'Houston suburbs', state: 'TX', cities: ['Sugar Land', 'Pearland', 'Katy', 'Baytown', 'League City'] },
  { metro: 'San Antonio',     state: 'TX', cities: ['San Antonio', 'Converse', 'Schertz', 'Universal City', 'New Braunfels'] },
  // Arizona
  { metro: 'Phoenix suburbs', state: 'AZ', cities: ['Mesa', 'Chandler', 'Scottsdale', 'Tempe', 'Gilbert'] },
  { metro: 'Tucson',          state: 'AZ', cities: ['Tucson', 'Marana', 'Oro Valley', 'Sahuarita', 'Green Valley'] },
  // Florida
  { metro: 'Orlando suburbs', state: 'FL', cities: ['Kissimmee', 'Sanford', 'Clermont', 'Apopka', 'Winter Garden'] },
  { metro: 'Tampa suburbs',   state: 'FL', cities: ['Clearwater', 'St. Petersburg', 'Brandon', 'Lakeland', 'Bradenton'] },
  // Nevada
  { metro: 'Las Vegas',       state: 'NV', cities: ['Las Vegas', 'Henderson', 'North Las Vegas', 'Summerlin', 'Enterprise'] },
]

// Priority niches — ordered by conversion rate (HVAC highest value)
export const PIPELINE_NICHES = [
  'hvac',
  'roofing',
  'plumbing',
  'dentist',
  'medspa',
  'lawfirm',
  'cleaning',
  'auto-detailing',
] as const
