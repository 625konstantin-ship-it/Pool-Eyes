const POOL_PROBLEMS_EN = [
  { id: 'clear', label: 'Clear water', desc: 'Normal condition', recommendations: [
    { level: 'ok', title: 'Water is fine', text: 'Clear water indicates balanced chemistry and working filtration. Continue regular pH and chlorine measurements.' }
  ]},
  { id: 'cloudy', label: 'Cloudy water', desc: 'Poor visibility at depth', recommendations: [
    { level: 'warn', title: 'Cloudy water', text: 'Common causes: low chlorine, high pH, organic load or filter issue. Check pH (7.2–7.6) and chlorine (1–3 mg/L). Run filtration 24–48 h, add flocculant per instructions.' },
    { level: 'info', title: 'Additionally', text: 'Vacuum the bottom, backwash the filter. For heavy cloudiness — shock chlorination.' }
  ]},
  { id: 'green', label: 'Green water', desc: 'Algae bloom', recommendations: [
    { level: 'crit', title: 'Green water — algae', text: 'Insufficient chlorine. Perform shock chlorination. Brush walls, run filter for 24 hours.' },
    { level: 'warn', title: 'Prevention', text: 'Maintain chlorine 1–3 mg/L, pH 7.2–7.6. Add algaecide.' }
  ]},
  { id: 'white', label: 'White / milky water', desc: 'Suspension, lime or excess chlorine', recommendations: [
    { level: 'warn', title: 'Milky water', text: 'Often due to high pH (>7.8) or excess chlorine. Check pH and lower with pH minus if needed.' },
    { level: 'info', title: 'What to do', text: 'Let the filter run 4–8 h. Do not overdose powdered chlorine.' }
  ]},
  { id: 'yellow', label: 'Yellow / metallic water', desc: 'Iron, copper, manganese', recommendations: [
    { level: 'warn', title: 'Yellowish tint', text: 'Usually iron or copper in water. Use a metal remover product.' },
    { level: 'info', title: 'Metallic sheen', text: 'Lower pH, add metal remover, vacuum the bottom.' }
  ]},
  { id: 'foam', label: 'Surface foam', desc: 'Detergents, organics', recommendations: [
    { level: 'warn', title: 'Foam on water', text: 'Often from detergent or cosmetic residues. Reduce use of cleaning products.' },
    { level: 'info', title: 'Removal', text: 'Add anti-foam, increase chlorination and filtration.' }
  ]},
  { id: 'sediment_bottom', label: 'Bottom sediment', desc: 'Dust, sand, flakes', recommendations: [
    { level: 'warn', title: 'Bottom sediment', text: 'Vacuum the bottom. Check chlorine — low levels may mean dead algae sediment.' },
    { level: 'info', title: 'Filtration', text: 'Backwash filter. Use flocculant if needed.' }
  ]},
  { id: 'floating', label: 'Suspension / flakes in water', desc: 'Floating particles', recommendations: [
    { level: 'warn', title: 'Floating particles', text: 'Often after shock chlorination or algae bloom. Run filter, vacuum.' },
    { level: 'info', title: 'Actions', text: 'White flakes — possible chemical overdose. Green — need chlorine and brushing.' }
  ]},
  { id: 'slippery', label: 'Slippery walls', desc: 'Biofilm, algae', recommendations: [
    { level: 'warn', title: 'Slipperiness', text: 'Early sign of algae. Brush walls, raise chlorine, add algaecide.' }
  ]},
  { id: 'smell', label: 'Chlorine / «swampy» smell', desc: 'Chloramines or organics', recommendations: [
    { level: 'warn', title: 'Strong chlorine smell', text: 'Often chloramines — shock chlorination needed.' },
    { level: 'crit', title: 'Swampy smell', text: 'Urgent shock chlorination, filter cleaning.' }
  ]},
  { id: 'eye_irritation', label: 'Eye / skin irritation', desc: 'pH or chloramines', recommendations: [
    { level: 'warn', title: 'Irritation', text: 'Most often pH outside 7.2–7.6. Measure pH and free chlorine.' }
  ]}
];
