# Play Store · Ficha y formularios de Test CAP

Todo lo que pide Play Console, listo para copiar. Imágenes en esta misma carpeta.

## 1. Datos de la app (al crearla)

| Campo | Valor |
|---|---|
| Nombre de la app | `Test CAP Mercancías y Viajeros` (30/30 caracteres) |
| Idioma predeterminado | Español (España) – es-ES |
| App o juego | App |
| Gratuita o de pago | Gratuita (no se puede cambiar a de pago después) |

## 2. Ficha principal de Play Store

**Descripción breve** (76/80):
```
Practica el examen CAP de mercancías y viajeros con simulacros y corrección.
```

**Descripción completa:**
```
Prepara el examen del CAP (Certificado de Aptitud Profesional) de mercancías o de viajeros con las preguntas del banco público que publica el Ministerio de Transportes.

QUÉ PUEDES HACER
• Simulacros de examen de 100 preguntas en 120 minutos, con la misma puntuación que el examen real.
• Examen de ampliación: solo las preguntas de la sección específica, para quien ya tiene el CAP de la otra modalidad.
• Práctica por temas: elige los objetivos que quieres repasar y ve la respuesta correcta al momento.
• Repaso de falladas: vuelve a las preguntas que fallaste.
• Corrección al final, como en el examen, o después de cada pregunta.
• Revisión de todas las respuestas, con la norma o la fuente de cada pregunta.
• Historial de tus resultados y nota media, guardado en tu cuenta y disponible en todos tus dispositivos.

CARACTERÍSTICAS
• Mercancías y viajeros en la misma app.
• Banco de preguntas actualizado cuando el Ministerio publica uno nuevo.
• Funciona sin conexión una vez descargadas las preguntas.
• Sin anuncios.
• Modo oscuro.

AVISO
Test CAP es una aplicación independiente. No tiene relación con el Ministerio de Transportes, la DGT ni ningún organismo público, ni los representa. Las preguntas proceden del banco público que publica el Ministerio de Transportes en:
https://www.transportes.gob.es/transporte-terrestre/examenes-y-formacion/examenes-de-formacion-de-conductores-profesionales-cap

Privacidad: https://wilfredmorales.github.io/Test-Cap/privacidad.html
```

**Recursos gráficos:**
| Campo | Archivo |
|---|---|
| Icono de la app (512×512) | `icono-512.png` |
| Gráfico de funciones (1024×500) | `imagen-destacada-1024x500.png` |
| Capturas de teléfono (2 a 8) | `capturas/01-acceso.png` … `07-historial.png` (sube las 6, en ese orden) |

Tablet: no hace falta subir capturas de tablet para publicar.

## 3. Datos de contacto y categoría (Presencia en la tienda → Configuración de la tienda)

| Campo | Valor |
|---|---|
| Categoría | Educación |
| Etiquetas | Educación, Exámenes y pruebas (las que ofrezca parecidas) |
| Correo electrónico | `testcap.app.sup@gmail.com` |
| Sitio web | `https://wilfredmorales.github.io/Test-Cap/` |
| Teléfono | Dejar vacío (es opcional) |

## 4. Contenido de la app (Política → Contenido de la app)

**Política de privacidad**: `https://wilfredmorales.github.io/Test-Cap/privacidad.html`

**Acceso a la app** → "Todas o algunas funciones tienen restricciones":
- Instrucciones: `La app requiere iniciar sesión. Use la cuenta de prueba indicada. Al iniciar sesión aparece una comprobación anti-robots de Cloudflare que se resuelve sola o con un clic.`
- Usuario: el correo de la **cuenta de revisor** (ver apartado 7).
- Contraseña: la de esa cuenta.
- Marca: "No se necesita ninguna otra información para acceder".

**Anuncios**: No, la app no contiene anuncios.

**Clasificación de contenido** (cuestionario IARC):
- Categoría: "Referencia, noticias o educación" (o "Todas las demás apps").
- Responde **No** a todo: violencia, sexo, lenguaje, drogas, apuestas, compras.
- ¿Los usuarios pueden interactuar o compartir contenido? **No** (no hay chat ni contenido entre usuarios).
- ¿Comparte la ubicación? **No**. ¿Compras digitales? **No**.
- Resultado esperado: PEGI 3 / Para todos.

**Público objetivo**: solo **18 años o más**. Si pregunta si atrae a niños: **No**.

**App de noticias**: No. **App gubernamental**: **No** (es independiente).
**Funciones financieras**: Ninguna. **Salud**: Ninguna.
**Ley de servicios digitales (UE)**: no es una plataforma en línea / no hay contenido de terceros; si pide estado de comerciante, indica tus datos o "No soy comerciante" según tu caso.

**Seguridad de los datos**:
| Pregunta | Respuesta |
|---|---|
| ¿Recoge o comparte datos de usuario? | Sí |
| ¿Datos cifrados en tránsito? | Sí |
| ¿Los usuarios pueden pedir que se eliminen sus datos? | Sí |
| URL de eliminación de cuenta | `https://wilfredmorales.github.io/Test-Cap/privacidad.html#eliminar-cuenta` |
| Datos **recogidos** (ninguno se **comparte** con terceros para sus fines) | |
| · Información personal → **Dirección de correo** | Recogido · Obligatorio · Funcionalidad de la app, Gestión de la cuenta |
| · Información personal → **Nombre** | Recogido · Obligatorio · Funcionalidad de la app, Gestión de la cuenta |
| · Actividad en la app → **Otras acciones del usuario** (resultados de los tests) | Recogido · Obligatorio · Funcionalidad de la app |
| · Ubicación, identificadores del dispositivo, diagnósticos, fotos, contactos… | **No** (la app no los recoge; la IP que guarda el servidor en sus registros técnicos es solo por seguridad y se borra a los pocos días) |
| ¿Se tratan de forma efímera? | No |

Supabase, GitHub, Google (correo) y Cloudflare actúan como **proveedores de servicios** (encargados): según Google, eso **no cuenta como "compartir"**.

## 5. Firma de la app

Al subir el primer AAB, Play Console ofrece la firma de apps de Google Play:
- Elige **"Permitir que Google cree y gestione mi clave de firma de apps" (recomendado)**.
- Tu clave actual (`CN=Test CAP`, SHA-256 `b39e23ef…2a39`) queda como **clave de subida**.
- Consecuencia: la app de Play tendrá otra firma que el APK manual. Quien tenga el APK manual debe
  **desinstalarlo una vez** antes de instalar desde Play (su progreso en el servidor no se pierde).

## 6. Prueba cerrada (obligatoria para cuentas personales)

1. Pruebas → **Prueba cerrada** → Crear canal (o usa "Alpha").
2. **Probadores**: crea una lista de correo con los Gmail de **al menos 12 personas**.
3. Crear versión → sube **`dist/test-cap.aab`** (descárgalo de
   `https://github.com/wilfredmorales/Test-Cap/raw/main/dist/test-cap.aab`).
4. Notas de la versión:
   ```
   <es-ES>
   Primera versión de prueba: simulacros, examen de ampliación, práctica por temas y repaso de falladas para el CAP de mercancías y viajeros.
   </es-ES>
   ```
5. Guardar → Revisar versión → **Iniciar lanzamiento a prueba cerrada**.
6. Comparte el **enlace de inscripción** a los probadores: cada uno lo abre con su cuenta de Google y pulsa "Unirme".
7. Requisito: **12 probadores inscritos durante 14 días seguidos**. Después: Panel → "Solicitar acceso a producción".

## 7. Cuenta de revisor de Google

Crea desde la app una cuenta **normal** (no administradora) solo para Google, por ejemplo con un Gmail nuevo
que no uses para nada más. No le actives la verificación en dos pasos y **no la borres** mientras la app esté
publicada: Google puede volver a revisarla en cualquier momento.

## 8. Cada actualización

El AAB se genera solo en cada cambio de `main` con un número de versión mayor. Para publicar una
actualización: Prueba cerrada (o Producción) → Crear versión → subir el `test-cap.aab` nuevo.
