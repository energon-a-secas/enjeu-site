# Enjeu: La Silla del Jefe

**Un módulo de expansión.** El juego base está completo sin él. Deja estas cartas
en la caja y nada más cambia.

**Qué agrega:** la silla vacía. Alguien viene tirando el dado del jefe todo este
tiempo, y este módulo le da ese trabajo a una persona.

No necesita nada. Solo cambia quién pone el número del jefe.

---

## 1. El dado se convierte en seis cartas

Saca las seis cartas de reacción. Son las seis caras del dado del jefe, en orden,
y dos son Golpe porque el dado tiene Golpe en dos caras.

| Cara | Carta | Qué hace |
|---|---|---|
| 1 | **Aguante** | Sin daño, y parte a la mitad lo que reciba hasta el final de tu próximo turno |
| 2 | **Golpe** | Su Daño |
| 3 | **Golpe** | Su Daño |
| 4 | **Invocación** | Dos de sus cartas de vida se mueven bajo una figura nueva |
| 5 | **Rugido** | Su Daño, y tu próxima tirada es un escalón más difícil |
| 6 | **Ruina** | Daño doble |

Baraja las seis. El jugador del jefe toma una mano, y el resto es un montón boca
abajo.

> **1.** Reparte una mano al jugador del jefe. **Cuántas cartas es toda la
> dificultad**, y es la misma perilla que usa el resto del juego: **Amable 1,
> Asistido 2, Hardcore 3.**
>
> **2.** Al empezar cada ronda, antes de que el héroe haga nada, el jugador del
> jefe pone una carta de su mano **boca abajo** frente al jefe. Salvo que ya haya
> una carta ahí.
>
> **3.** Cuando el jefe actúa, dala vuelta. Eso es lo que hace. Resuélvelo tal
> como ya dice el reglamento.
>
> **4.** Después queda boca arriba en la **Fila**, y el jugador del jefe roba
> hasta completar su mano si al montón le quedan cartas.
>
> **5.** **Cuando la Fila llega a tres, barre.** Baraja las seis juntas otra vez
> y reparte una mano nueva. Barre también si al jugador del jefe se le acaba la
> mano antes.

---

## 2. Por qué una mano de uno es lo amable

Con una carta, el jugador del jefe no elige nada: tiene lo que le tocó y lo
juega. De eso se trata. Un adulto que quiere ser amable no debería tener que
fingirlo, y fingir es justo lo que un niño nota.

Con dos, hay una decisión cada ronda. Con tres, hay un plan.

**El tamaño de la mano es la ventaja que das.** Nada más del jefe cambia: su
Daño, su ronda de Furia y su movimiento característico son los que dice el
reglamento.

---

## 3. Las dos cosas que evitan que sea cruel

**Ruina no puede ser la primera carta de una pelea.** Encontrarse con daño doble
antes de haber jugado un solo turno no le enseña nada a un niño salvo que el
juego es injusto. Después de la ronda uno está disponible como cualquier otra.

**Desde la ronda de Furia, la carta va boca arriba.** La Furia es cuando se
decide la pelea, y un niño que ve venir lo peor todavía puede hacer algo. Esto le
cuesta al jugador del jefe su engaño justo cuando más importaría, y es a
propósito.

---

## 4. Lo que este módulo no promete

Sería fácil escribir "el jugador del jefe nunca puede pegar más fuerte que el
dado, solo puede elegir cuándo". No es cierto, y lo medimos antes de sacarlo.

Es cierto a lo largo de un ciclo completo de seis cartas. Las peleas de este
juego duran entre tres y cinco rondas, así que el ciclo casi nunca se completa:
el jefe juega sus tres mejores cartas y nunca conoces el resto. Barrer cada tres
en vez de cada seis es lo que hace que la promesa muerda dentro de una pelea de
verdad, y por eso la regla 5 dice tres.

Aun así: **un segundo jugador que elige bien es más difícil que un dado, y a eso
viniste.** Si quieres las probabilidades del dado, tira el dado. Si quieres a
alguien del otro lado de la mesa decidiendo cuándo cae el martillo, toma la
silla, y usa el tamaño de la mano para decir cuánto quieres que pueda pensar.

---

## 5. Qué se midió

Como "un adulto del otro lado de la mesa" no es un número, esto se midió con un
bot ocupando la silla, 2.500 peleas por celda, contra la misma pelea con dado
(`node tools/checks/seat.mjs`).

**La mano de 1 es el dado, casi exacto.** Cada celda queda dentro de unos tres
puntos. La única diferencia constante es que el nivel 1 es un par de puntos más
amable, que es la regla de "Ruina nunca abre una pelea" haciendo justo lo que se
le pidió.

**Las manos de 2 y 3 son más difíciles, y bastante.** Un jugador del jefe que
siempre gasta su carta más grande baja a un héroe cuidadoso del 88% al 77% en el
nivel 1, y del 28% al 17% en el nivel 3. Contra alguien que nunca apuesta una
carta de vida es durísimo: del 49% al 24% con mano de 2, y al 5% con mano de 3.

**Y jugar con paciencia es lo más débil.** Guardarse Ruina para la ronda de Furia
midió entre seis y doce puntos MÁS FÁCIL para el héroe que simplemente gastar la
carta más grande cada turno, porque la mayoría de las peleas terminan antes de
que llegue la Furia y el jefe las pasó jugando sus cartas chicas.

Vale la pena saberlo en vez de esconderlo, porque te da una segunda perilla. Si
quieres ser blando sin que se note, **guárdate el martillo.** Cuenta una historia
mejor, te cuesta la pelea, y el niño no te ve haciéndolo.

---

## 6. Dos jugadores sin la silla

Si quieres un segundo jugador y no un rival, no necesitas este módulo. El juego
base ya tiene la carta **Compinche**: una sola reserva de vida compartida, y el
segundo jugador es dueño de Golpe e Invención. Ver
[RULES.es.md sección 8b](RULES.es.md).

Antes decía Golpe y Escape, que le daba al segundo jugador dos cartas sin tirada
y después le decía que tirara. Ahora dice Invención, que tiene tirada Loca y
apuesta, así que tira dados de verdad y dice un hechizo inventado en voz alta.

---

## 7. Componentes

| Mazo | Cartas |
|---|---|
| Reacción: las seis caras | 6 |
| La Silla (una ayuda) | 1 |
| **Total** | **7** |

Una hoja A4.

---

## Referencia rápida

- Seis cartas son las seis caras. Dos son Golpe.
- Mano de 1, 2 o 3. Esa es toda la dificultad.
- Compromete boca abajo antes de que el héroe actúe. Dala vuelta cuando el jefe actúa.
- Barre la Fila después de tres, o cuando se acabe la mano.
- Ruina nunca abre una pelea. Desde Furia, compromete boca arriba.
