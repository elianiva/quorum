---
title: Diseñar un rastreador web
seoTitle: Diseñar un rastreador web: guía de entrevista de diseño de sistemas
summary: Diseña un rastreador web para una entrevista de diseño de sistemas: frontera de URLs, deduplicación, cortesía, frescura y shardeo del rastreo, y lo que enseña Quorum.
section: guides
order: 30
aliases: web crawler, crawler, spider, url frontier, deduplication, politeness, robots.txt, search engine, system design primer, system design interview, rastreador web, araña, frontera de URLs, deduplicación, cortesía, motor de búsqueda, entrevista de diseño de sistemas
---

Un rastreador web es un bucle alrededor de una cola de URLs. Los workers toman una URL de una frontera, descargan la página, la guardan, extraen sus enlaces, descartan los ya vistos y devuelven el resto a la frontera. Lo difícil no es la descarga. Es la deduplicación, la cortesía con cada sitio y mantener fresca una cantidad de mil millones de páginas.

Esta es una de las preguntas del [System Design Primer](https://github.com/donnemartin/system-design-primer), y su [solución para el rastreador web](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/web_crawler/README.md) merece leerse junto a esta página.

## Requisitos

Funcionales:

- Empezar desde URLs semilla y seguir enlaces por toda la web.
- Guardar cada página y pasarla a la indexación para que una búsqueda pueda encontrarla.
- Volver a rastrear páginas según un calendario, y con más frecuencia las que cambian.
- No entrar nunca en un bucle infinito por un ciclo de enlaces o una página de calendario con enlaces interminables a "el mes siguiente".

No funcionales:

- Educado: respetar robots.txt y no machacar nunca a un host.
- Escala añadiendo máquinas.
- Tolera hosts caídos, hosts lentos y HTML mal formado.

El ranking de búsqueda y la personalización quedan fuera del alcance. El rastreador los alimenta.

## Estima la carga

Supón 1.000 millones de páginas conocidas, cada una refrescada más o menos una vez por semana, a 500 KB por página.

- Ritmo de descarga: 1.000.000.000 de páginas cada 7 días son unas 1.650 páginas por segundo. Redondea a 2.000 para dejar margen.
- Almacenamiento: 1.000.000.000 x 500 KB son 500 TB para una copia completa. Conservar el historial de las páginas que cambian lo acerca a los petabytes.
- Ancho de banda: 2.000 páginas por segundo x 500 KB son unos 1 GB por segundo de entrada, alrededor de 8 Gbit/s.
- Workers: si una descarga tarda 500 ms, 2.000 por segundo necesitan unas 1.000 descargas en vuelo, así que unas pocas decenas de máquinas con muchas conexiones cada una.

Descargar es trabajo de ancho de banda y almacenamiento, no de CPU.

## El diseño

### La frontera de URLs

La frontera guarda las URLs que esperan ser rastreadas. Una [Cola](/components/queue) FIFO simple rastrea el mismo host ocupado de golpe, así que las fronteras reales tienen dos capas. Una capa de prioridad ordena las URLs por importancia y ritmo de cambio esperado. Una capa de cortesía mantiene una cola por host y libera una URL por host cada pocos segundos. Sirven tanto los sorted sets de Redis como las particiones de Kafka con el host como clave.

### Descargadores

Un grupo de [Workers](/components/worker) toma URLs de la frontera. Cada uno hace una consulta DNS, comprueba el robots.txt del host (cacheado un día), descarga con un timeout y escribe la página en bruto. Como muchos Workers sacan de una misma Cola, escalas añadiendo Workers. Mira [consumidores competidores](/patterns/competing-consumers).

### Deduplicación

Dos comprobaciones. Para las URLs, normaliza primero (host en minúsculas, quita los fragmentos, ordena los parámetros de consulta), y luego comprueba un hash del resultado contra un conjunto de vistos, con un filtro de Bloom delante para que la mayoría de las comprobaciones se salten el disco. Para el contenido, guarda un hash como SimHash de cada página, de modo que dos espejos del mismo artículo cuenten una vez. Esto es lo que detiene los ciclos y las trampas para arañas. Un tope de profundidad y de número de URLs por sitio atrapa las trampas que los hashes no ven.

### Almacenamiento y traspaso al índice

Las páginas en bruto van a [Almacenamiento de objetos](/components/storage) como S3, y los metadatos (URL, hash, hora del último rastreo, hora del próximo rastreo) van a un almacén clave-valor o de columna ancha. Cada página guardada encola un trabajo para el indexador y para el constructor de fragmentos, así que el rastreo y la indexación corren a su propio ritmo. Las versiones viejas pasan a clases más baratas con [reglas de ciclo de vida](/patterns/object-storage-and-lifecycle-rules).

### Frescura

Guarda una hora de próximo rastreo por URL. Una página que cambió en tres de las últimas tres visitas recibe un intervalo más corto, y una que nunca cambia recibe uno más largo. Los sitemaps y las cabeceras `Last-Modified` ahorran descargas.

## Dónde falla

**Un atasco que nadie ve.** Los descargadores se frenan en un tramo malo de la web y la frontera crece sin límite. Limita la cola y rechaza o aplaza las URLs de baja prioridad, como en [contrapresión](/patterns/backpressure).

**Un host se lleva todo el rastreo.** Un sitio con millones de enlaces generados llena la frontera. Las colas por host y los topes por host lo mantienen en su parte, que es la misma idea que la [limitación de tasa](/patterns/rate-limiting) aplicada al servidor de un tercero.

**Reintentos a hosts caídos.** Reintentar de inmediato un host que falla malgasta el presupuesto de descargas. Usa [reintentos con backoff](/patterns/retry-with-backoff) y pon a los reincidentes en un carril lento.

**Coste de almacenamiento.** Las páginas viejas se leen rara vez y la factura crece cada mes, así que bájalas de nivel.

## Constrúyelo en Quorum

El juego modela bien el núcleo de cola y workers. Este tablero muestra los descargadores como varios [Workers](/components/worker) que vacían una sola [Cola](/components/queue), la parte de frontera a descargador de la respuesta:

::Design{id="competing-workers"}

Mira cómo la Cola ofrece trabajo a cada Worker, y qué hace una caída con las tareas que un Worker tenía en vuelo. Ese es el verdadero compromiso de la concurrencia en una flota de descargadores.

El siguiente tablero muestra la frontera con un límite. Usa una Cola con una longitud máxima y un Worker más lento que las llegadas:

::Design{id="queue-bounded"}

Lee los rechazos: pasado el límite la Cola rechaza trabajo, y sin límite la profundidad solo crece. Ese es el problema del atasco de arriba.

El último tablero muestra la cola del almacenamiento, con [Almacenamiento de objetos](/components/storage) y una ventana de ciclo de vida:

::Design{id="lifecycle-storage"}

Muestra que una petición de un objeto archivado no se puede responder al instante, y por eso las páginas viejas de un rastreador, que se leen rara vez, pueden quedarse en almacenamiento frío.

Desbloquea las piezas con [Trabajos en segundo plano](/research/background-jobs), [Colas de mensajes](/research/queues) y [Almacenamiento de objetos](/research/object-storage). [Capacidad, utilización y colas](/explanation/queues) explica por qué la espera crece con la carga.

El juego no tiene URLs, ni grafo de enlaces, ni robots.txt, ni hosts con los que ser educado, ni deduplicación. La Cola es una sola línea plana de tareas, no una frontera con prioridades. La cortesía y la deduplicación las aprendes en esta página.

## Preguntas frecuentes

### ¿Cómo evita un rastreador web rastrear dos veces la misma página?

Normaliza cada URL y comprueba un hash de ella contra un conjunto de vistos, normalmente con un filtro de Bloom delante. Para el contenido espejado bajo URLs distintas, compara además una huella del contenido.

### ¿Qué es una frontera de URLs?

Es la cola de URLs que esperan ser descargadas, dividida en niveles de prioridad y colas por host. Los niveles deciden qué rastrear primero, y las colas por host evitan que se golpee a un sitio demasiado rápido.

### ¿Cómo haces que un rastreador sea educado?

Lee el robots.txt de cada sitio, mantén una cola por host y espacia las peticiones a ese host unos segundos. Reduce el ritmo cuando el host responde despacio o con errores.

### ¿Dónde encaja el rastreador del System Design Primer?

El Primer acota el problema a un rastreador que alimenta un índice inverso y un servicio de fragmentos, con una tabla de enlaces ordenada y una tabla de firmas de páginas. Esta página sigue la misma forma y añade la frontera, la cortesía y los niveles de almacenamiento.
