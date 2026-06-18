const POOL_PROBLEMS_ES = [
  { id: 'clear', label: 'Agua clara', desc: 'Estado normal', recommendations: [
    { level: 'ok', title: 'El agua está bien', text: 'El agua clara indica química equilibrada y filtración en funcionamiento. Continúe con mediciones regulares de pH y cloro.' }
  ]},
  { id: 'cloudy', label: 'Agua turbia', desc: 'Mala visibilidad en profundidad', recommendations: [
    { level: 'warn', title: 'Agua turbia', text: 'Causas frecuentes: poco cloro, pH alto, carga orgánica o problema del filtro. Compruebe pH (7.2–7.6) y cloro (1–3 mg/L). Mantenga la filtración 24–48 h, añada floculante según las instrucciones.' },
    { level: 'info', title: 'Además', text: 'Aspire el fondo, lave el filtro. Con turbidez intensa — cloración de choque.' }
  ]},
  { id: 'green', label: 'Agua verde', desc: 'Floración de algas', recommendations: [
    { level: 'crit', title: 'Agua verde — algas', text: 'Cloro insuficiente. Realice cloración de choque. Cepille las paredes, deje el filtro funcionando 24 horas.' },
    { level: 'warn', title: 'Prevención', text: 'Mantenga cloro 1–3 mg/L, pH 7.2–7.6. Añada algicida.' }
  ]},
  { id: 'white', label: 'Agua blanca / lechosa', desc: 'Suspensión, cal o exceso de cloro', recommendations: [
    { level: 'warn', title: 'Agua lechosa', text: 'A menudo por pH alto (>7.8) o exceso de cloro. Compruebe el pH y bájelo con reductor de pH si es necesario.' },
    { level: 'info', title: 'Qué hacer', text: 'Deje funcionar el filtro 4–8 h. No sobredosifique el cloro en polvo.' }
  ]},
  { id: 'yellow', label: 'Agua amarilla / metálica', desc: 'Hierro, cobre, manganeso', recommendations: [
    { level: 'warn', title: 'Tono amarillento', text: 'Normalmente hierro o cobre en el agua. Use un producto eliminador de metales.' },
    { level: 'info', title: 'Brillo metálico', text: 'Baje el pH, añada eliminador de metales, aspire el fondo.' }
  ]},
  { id: 'foam', label: 'Espuma en la superficie', desc: 'Detergentes, materia orgánica', recommendations: [
    { level: 'warn', title: 'Espuma en el agua', text: 'A menudo por restos de detergente o cosméticos. Reduzca el uso de productos de limpieza.' },
    { level: 'info', title: 'Eliminación', text: 'Añada antiespumante, aumente la cloración y la filtración.' }
  ]},
  { id: 'sediment_bottom', label: 'Sedimento en el fondo', desc: 'Polvo, arena, copos', recommendations: [
    { level: 'warn', title: 'Sedimento en el fondo', text: 'Aspire el fondo. Compruebe el cloro — niveles bajos pueden indicar sedimento de algas muertas.' },
    { level: 'info', title: 'Filtración', text: 'Lave el filtro. Use floculante si es necesario.' }
  ]},
  { id: 'floating', label: 'Suspensión / copos en el agua', desc: 'Partículas flotantes', recommendations: [
    { level: 'warn', title: 'Partículas flotantes', text: 'A menudo tras cloración de choque o floración de algas. Active el filtro, aspire.' },
    { level: 'info', title: 'Acciones', text: 'Copos blancos — posible sobredosis química. Verdes — hace falta cloro y cepillado.' }
  ]},
  { id: 'slippery', label: 'Paredes resbaladizas', desc: 'Biofilm, algas', recommendations: [
    { level: 'warn', title: 'Resbaladizo', text: 'Señal temprana de algas. Cepille las paredes, suba el cloro, añada algicida.' }
  ]},
  { id: 'smell', label: 'Olor a cloro / «pantano»', desc: 'Cloraminas u orgánicos', recommendations: [
    { level: 'warn', title: 'Olor fuerte a cloro', text: 'A menudo cloraminas — se necesita cloración de choque.' },
    { level: 'crit', title: 'Olor a pantano', text: 'Cloración de choque urgente, limpieza del filtro.' }
  ]},
  { id: 'eye_irritation', label: 'Irritación de ojos / piel', desc: 'pH o cloraminas', recommendations: [
    { level: 'warn', title: 'Irritación', text: 'Lo más frecuente es pH fuera de 7.2–7.6. Mida pH y cloro libre.' }
  ]}
];

if (typeof window !== 'undefined') window.POOL_PROBLEMS_ES = POOL_PROBLEMS_ES;
