---
title: Diseñar un almacén clave-valor como Redis o Dynamo
seoTitle: Diseñar un almacén clave-valor como Redis o Dynamo
summary: Diseña un almacén clave-valor distribuido como Redis o Dynamo: particiona con hashing consistente, replica y ajusta las lecturas y escrituras de quórum.
section: guides
order: 22
aliases: system design primer, key value store, distributed key value store, dynamo, dynamodb, cassandra, nosql, consistent hashing, quorum, system design interview, almacén clave-valor, hashing consistente, quórum, entrevista de diseño de sistemas
---

Un almacén clave-valor distribuido reparte las claves entre muchas máquinas con hashing consistente, copia cada clave en N réplicas y usa quórums para que las lecturas y escrituras sobrevivan a un nodo caído. Elige W y R por petición: con R + W mayor que N una lectura ve la última escritura, y con valores menores cambias frescura por velocidad. Esta es la forma de Dynamo de Amazon, DynamoDB y Cassandra.

Esta pregunta está en la [lista de preguntas adicionales](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions) del [System Design Primer](https://github.com/donnemartin/system-design-primer).

## Requisitos

Funcionales:

- `put(key, value)` y `get(key)`, con valores de hasta unos cientos de KB.
- Borrado y TTL opcionales.

No funcionales:

- Lecturas y escrituras de un solo dígito de milisegundos en el percentil 99.
- Alta disponibilidad para escrituras: la caída de un nodo no debe detener el almacén.
- Escala horizontalmente añadiendo máquinas, con poco movimiento de datos.
- Consistencia eventual por defecto, con lecturas más fuertes cuando el llamante las pide.

## Estima la carga

Supón 1,000 millones de claves, 1 KB por valor, 100,000 peticiones por segundo con 4 lecturas por cada escritura.

- Datos en bruto: 1,000,000,000 x 1 KB son 1 TB. Con N de 3 son 3 TB en disco.
- Máquinas: a 1 TB por nodo, 3 TB son 3 nodos por capacidad. Por throughput, si un nodo sirve 10,000 operaciones por segundo, 100,000 / 10,000 son 10 nodos antes del coste de replicación.
- Coste de escritura: 20,000 escrituras por segundo x 3 réplicas son 60,000 escrituras de réplica por segundo. Las lecturas con R de 2 cuestan 80,000 x 2, o 160,000 lecturas de réplica.

Así que el throughput, y no el almacenamiento, fija el tamaño del clúster. Planea unos 25 nodos con margen.

## El diseño

### Particionado

Aplica el hash de cada clave sobre un anillo y entrégala al siguiente nodo en el sentido de las agujas del reloj. Añadir un nodo mueve solo la porción de su vecino, mientras que `hash(key) % n` reasignaría casi todo. Cada máquina toma muchos nodos virtuales para que las porciones se igualen. Mira el [hashing consistente](/patterns/consistent-hashing) y el [sharding](/patterns/sharding).

### Replicación

Guarda cada clave en los N nodos distintos siguientes del anillo, normalmente N de 3, idealmente en zonas distintas. Cualquier nodo puede coordinar una petición, así que no hay un líder que perder. Mira las [Estrategias de replicación](/patterns/replication-strategies).

### Lecturas y escrituras de quórum

Una escritura tiene éxito cuando W réplicas la confirman, y una lectura consulta R réplicas y devuelve la versión más reciente.

| N, W, R | Comportamiento                                               |
| ------- | ------------------------------------------------------------ |
| 3, 2, 2 | La lectura ve la última escritura, sobrevive a un nodo caído |
| 3, 1, 1 | Lo más rápido, una lectura puede estar obsoleta              |
| 3, 3, 1 | Lecturas rápidas, pero un nodo caído bloquea las escrituras  |

Hacer esto ajustable por petición es lo que hacen la bandera de lectura fuertemente consistente de DynamoDB y los niveles de consistencia de Cassandra. Los detalles están en [Lecturas y escrituras de quórum](/patterns/quorum-reads-and-writes).

### Conflictos y reparación

Las escrituras concurrentes a una clave necesitan una regla: gana la última escritura según la marca de tiempo, o relojes vectoriales que conservan ambas versiones. Las réplicas que se perdieron una escritura se ponen al día con la reparación en lectura y con la anti-entropía en segundo plano. Un nodo que está caído un momento recibe hinted handoff.

## Dónde se rompe

**Una clave está caliente.** Una clave popular vive en N nodos, así que más nodos no ayudan. Ponle una caché delante, divídela en varias subclaves o reparte las lecturas entre todas las réplicas. Mira las [claves calientes y shards calientes](/patterns/hot-keys-and-hot-shards) y el incidente [Clave caliente](/incidents/hot-key).

**Una partición divide el anillo.** Con W y R de 1, ambos lados aceptan escrituras y divergen. Un quórum de 2 detiene el lado minoritario. Esta es la elección de CAP: [CAP y PACELC](/patterns/cap-and-pacelc) la expone, y el incidente [Partición de red](/incidents/partition) la muestra en acción.

**Las lecturas obsoletas sorprenden a los usuarios.** Un usuario escribe y lee de vuelta un valor antiguo. Enruta a ese usuario a la réplica que recibió la escritura, o sube R. Mira [Lee tus propias escrituras](/patterns/read-your-writes) y los [Modelos de consistencia](/patterns/consistency-models).

## Constrúyelo en Quorum

Investiga [Replicación sin líder](/research/leaderless) y coloca un [Almacén de columnas anchas](/components/wide), el Cassandra del juego. Su tarjeta toma N, R y W, así que pon R + W por encima de N y luego por debajo, y mira aparecer las lecturas obsoletas y cambiar el coste por petición.

El primer Tablero es la respuesta con quórum. Un Servidor de aplicaciones habla con un Almacén de columnas anchas con tres réplicas por clave y un quórum de lectura y escritura de dos, así que R + W está por encima de N. Mira cómo se gasta la capacidad del almacén, porque una escritura cuesta N operaciones de réplica y una lectura cuesta R, y por eso el tamaño del clúster sigue al throughput y no al almacenamiento. Usa un [Servidor de aplicaciones](/components/server) y un [Almacén de columnas anchas](/components/wide), y el patrón es [Lecturas y escrituras de quórum](/patterns/quorum-reads-and-writes).

::Design{id="wide-column-quorum"}

El segundo Tablero añade el resto de una capa de datos real. Una [API Gateway](/components/gw) envía las consultas por clave al servidor de aplicaciones que habla con el almacén de quórum, y envía las búsquedas y las subidas, que un almacén clave-valor no puede responder, a un segundo servidor de aplicaciones y a una [Base de datos](/components/database). Un llamador lee un solo grupo de datos, así que cada almacén tiene su propio servidor de aplicaciones. Mira qué peticiones van a qué almacén. Muestra el punto de entrevista de que un almacén clave-valor solo busca por clave, y la Base de datos cubre todo lo demás. [SQL distribuido y almacenes sin líder](/patterns/distributed-sql-and-leaderless-stores) pone los dos tipos lado a lado.

::Design{id="quorum-store"}

El tercer Tablero es el particionado. A una Base de datos se le dan cuatro shards sobre una clave hash, así que las claves se reparten de forma uniforme y ningún shard va caliente, que es el sentido de aplicar el hash de una clave sobre un anillo. Mira la carga de cada shard. Usa una [Base de datos](/components/database) y no un almacén, y reparte las claves en shards fijos, lo que es más simple que un anillo con nodos virtuales. Mira el [sharding](/patterns/sharding) y el [hashing consistente](/patterns/consistent-hashing).

::Design{id="sharded-hash-key"}

El Sandbox [Clave caliente](/sandboxes/hot-key) muestra una sola clave sobrecargando sus réplicas.

El juego cubre la replicación y los ajustes de quórum, además de la colocación de claves en réplicas. No modela la resolución de conflictos, el hinted handoff ni la reparación en lectura, así que eso queda como teoría de entrevista. Tampoco te deja añadir un nodo y ver cómo se reequilibra un anillo.

## Preguntas frecuentes

### ¿Cuál es la diferencia entre un almacén clave-valor y una base de datos?

Un almacén clave-valor solo busca por clave, lo que le permite hacer sharding y replicación de forma simple y responder en milisegundos. Una base de datos relacional añade joins, índices secundarios y transacciones, y los paga en escalabilidad.

### ¿Cómo funciona el hashing consistente en un almacén clave-valor?

Los nodos y las claves se aplican con hash sobre el mismo anillo, y cada clave pertenece al siguiente nodo en el sentido de las agujas del reloj. Cuando un nodo entra o sale, solo se mueven las claves que tiene al lado, cerca de 1/n de los datos.

### ¿Qué significa R + W > N?

Significa que todo conjunto de lectura se solapa con todo conjunto de escritura en al menos una réplica, así que una lectura llega a un nodo que tiene la última escritura confirmada. Mejora la frescura, pero no es linealizabilidad completa.

### ¿Un almacén clave-valor debe ser consistente o disponible?

Para la mayoría de los casos, disponible: los carritos de compra y las sesiones toleran una lectura obsoleta. Para saldos e inventario, pide lecturas de quórum o usa un almacén de consenso.
