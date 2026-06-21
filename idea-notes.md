Chcę zbudować małą webową aplikację o nazwie Point\&Click Scene Forge.



Aplikacja ma pomagać solo twórcom gier point-and-click zamieniać luźne pomysły na sceny w uporządkowane karty scen, które można później wykorzystać w pracy produkcyjnej nad grą.

Problem, który chcę rozwiązać: pomysły na sceny, zagadki, NPC, dialogi i interaktywne obiekty często są rozproszone w luźnych notatkach. Trudno wtedy ocenić, czy dana scena ma jasny cel gracza, konkretną przeszkodę, sensowną interakcję, potrzebne assety i czy jest gotowa do dalszej pracy.



Użytkownik najpierw tworzy projekt gry i dodaje krótki kontekst projektu: tytuł, gatunek, ton gry, krótkie założenie fabularne, głównego bohatera, styl dialogów i ograniczenia produkcyjne. To nie ma być pełna game bible, tylko krótki kontekst, który pomaga AI lepiej rozumieć sceny.



W projekcie użytkownik może też dodać prostą listę postaci. 

Postać może być protagonistą, NPC-em, antagonistą, companionem albo innym typem postaci. Dla każdej postaci użytkownik określa nazwę, rolę, krótki opis, sposób mówienia lub nastawienie. 

W MVP postacie są tylko kontekstem dla generowania i walidacji scen, nie osobnym zaawansowanym modułem.

Następnie użytkownik dodaje scenę jako luźną notatkę. 

Taka notatka może opisywać sytuację, lokację, NPC, problem gracza, pomysł na zagadkę albo ogólny klimat sceny.



Główna funkcja aplikacji to Forge Scene. 

Po jej uruchomieniu aplikacja z pomocą AI bierze kontekst projektu gry, wybrane postacie i luźną notatkę sceny, a następnie generuje uporządkowaną kartę sceny.



Karta sceny powinna zawierać:

\-cel gracza w scenie,

\-główną przeszkodę,

\-postacie obecne w scenie,

\-funkcję każdej postaci w scenie,

\-nastawienie NPC do gracza w tej scenie,

\-interaktywne obiekty,

\-prosty pomysł na zagadkę lub interakcję,

\-dialog beats,

\-wymagane assety,

\-ryzyka projektowe lub brakujące elementy,

\-sugerowany status sceny.



Najważniejsza wartość aplikacji to nie samo przechowywanie notatek, ale ocena gotowości sceny do produkcji.



Jednozdaniowa reguła biznesowa:

Scena może dostać status Ready tylko wtedy, gdy ma jasno określony cel gracza, przeszkodę, co najmniej jeden element interakcji lub zagadki, listę wymaganych assetów, określoną funkcję postaci w scenie oraz brak krytycznych luk logicznych.



Statusy sceny w MVP:

\-Draft,

\-Needs Work,

\-Ready.



MVP ma być bardzo małe. Pierwszy wartościowy przepływ użytkownika:

\-Użytkownik tworzy projekt gry.

\-Dodaje krótki opis projektu.

\-Dodaje jedną lub kilka prostych postaci.

\-Dodaje scenę jako luźną notatkę.

\-Uruchamia Forge Scene.

\-Dostaje wygenerowaną kartę sceny.

\-Widzi brakujące elementy lub ryzyka.

\-Może edytować wynik i zapisać status sceny.



W MVP nie budujemy:

\-eksportu do Unity,

\-eksportu do Adventure Creator,

\-generowania grafik,

\-pełnej game bible,

\-zaawansowanego edytora dialogów,

\-drzewek dialogowych,

\-timeline’u całej gry,

\-asset managera,

\-mapy lokacji,

\-systemu questów,

\-relacji między NPC,

\-systemu reputacji,

\-współpracy wielu użytkowników,

\-komentarzy,

\-wersjonowania scen,

\-integracji z zewnętrznymi narzędziami.



Chcę, żeby MVP było naprawdę małe, ale wystarczające do spełnienia wymagań projektu kursowego: powinno mieć kontrolę dostępu, zarządzanie danymi, prostą logikę biznesową, sensowny pierwszy przepływ użytkownika i możliwość późniejszego dodania testu sprawdzającego główny flow.

Przeprowadź mnie przez /10x-shape pytanie po pytaniu. Pilnuj, żeby zakres MVP nie urósł za bardzo. Jeśli zaproponuję coś za dużego, nazwij to wprost i pomóż mi przyciąć zakres.





Kryteria sukcesu MVP:

\- Co najmniej 70% wygenerowanych kart sceny jest zaakceptowanych przez użytkownika jako użyteczna baza do dalszej edycji, bez konieczności pełnego przepisania od zera.

\- Użytkownik może przekształcić luźną notatkę sceny w uporządkowaną kartę sceny w mniej niż 5 minut.

\- Wygenerowana karta sceny zawiera wszystkie kluczowe elementy wymagane do oceny gotowości sceny: cel gracza, przeszkodę, postacie obecne w scenie, funkcję postaci/NPC, interaktywny element lub zagadkę, wymagane assety oraz ryzyka lub brakujące elementy.



