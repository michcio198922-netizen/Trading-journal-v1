# SMC Trading Journal Android v5.3

Wersja 5.3 dodaje Playbook setupów.

Nowe funkcje:
- osobna zakładka Playbook,
- tworzenie, edycja i usuwanie własnych setupów,
- kierunek, sesja, minimalne RR, warunki wejścia, invalidation, target i notatki,
- przykładowy screenshot idealnego setupu,
- wybór playbooka przy dodawaniu trade'a,
- automatyczne uzupełnianie modelu, kierunku, sesji i elementów Pre-Trade Plan,
- statystyki każdego playbooka: liczba trade'ów, win rate, średnie R i łączne R,
- panel Playbook performance na dashboardzie,
- filtr historii po playbooku,
- playbooki i ich screenshoty są uwzględniane w backupie.

Aktualizacja zachowuje istniejące trade'y, review i screenshoty. Package ID i podpis aplikacji pozostają bez zmian.


## v5.4 — Confirmation Filter
- Checklista przed trade'em: Confirmation, Key Level, Liquidity, News soon, No displacement i HTF FVG przeciwko wejściu.
- Live score i werdykt TAKE IT / WAIT / NO TRADE.
- Filtr jest procesową checklistą użytkownika, nie automatycznym sygnałem rynkowym.
- Zapis wyniku filtra przy każdym trade i szczegóły w historii.
- Dashboard porównuje performance trade'ów wg werdyktu filtra.
- Backup zachowuje dane Confirmation Filter.


## v5.5 — Własne filtry ZA / PRZECIW
- Confirmation Filter nie jest już ograniczony do sześciu pozycji.
- Możesz dodawać własne kryteria ZA i PRZECIW trade'owi.
- Każdemu własnemu kryterium ustawiasz wagę 1 albo 2.
- Własne kryteria są zapamiętywane i pojawiają się przy kolejnych trade'ach.
- Możesz usuwać własne kryteria bez psucia historii — zapisane trade'y zachowują snapshot użytych filtrów.
- Backup eksportuje i importuje także listę własnych kryteriów.
- Istniejące dane z v5.4 pozostają kompatybilne.


## v5.6 — Tagi trade'ów
- własne tagi przy każdym trade'zie,
- startowe tagi: Statystyczny stop loss, Take profit, Stop loss z błędem,
- możliwość dodawania i usuwania własnych tagów,
- automatyczna podpowiedź podstawowego tagu po wyborze TP/SL i błędu,
- filtr historii po tagu,
- statystyki tagów: liczba trade'ów, WR, średnie R i suma R,
- tagi oraz biblioteka tagów są objęte backupem.


## v5.7
- Naprawione wpisywanie wartości ujemnych w polach R/RR na Androidzie/Samsungu.
