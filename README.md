# Google Forms AutoFill Chrome Extension

Zaawansowane rozszerzenie Chrome do automatycznego wypełniania formularzy Google z zarządzaniem profilami i łańcuchami wykonywania.

## 🚀 Funkcje

### ✨ Podstawowe funkcje
- **Automatyczne wypełnianie** formularzy Google Forms
- **Zarządzanie profilami** - tworzenie, edycja, usuwanie profili
- **Inteligentne wykrywanie pól** - automatyczne rozpoznawanie typów pól
- **Zaawansowane selektory XPath** - precyzyjne lokalizowanie elementów
- **Skróty klawiszowe** - szybkie wypełnianie przez Alt+1, Alt+2, itd.

### 🔗 Łańcuchy profili (Chain Execution)
- **Sekwencyjne wykonywanie** - jeden profil automatycznie uruchamia następny
- **Ochrona przed cyklami** - wykrywanie i zapobieganie nieskończonym pętlom
- **Wizualne wskaźniki** - wyraźne oznaczenie profili z łańcuchami
- **Inteligentne zarządzanie** - ograniczenie głębokości łańcucha do 10 poziomów

### ⌨️ Skróty klawiszowe
- `Alt+1-9, Q-P` - wypełnienie profili użytkownika
- `Ctrl+Shift+F` - ostatnio używany profil
- `Ctrl+Shift+M` - najczęściej używany profil
- `Ctrl+Shift+1/2/3` - top 3 profile według popularności
- `Ctrl+Shift+D` - wykryj pola formularza
- `Ctrl+Shift+H` - pokaż pomoc ze skrótami

## 📁 Struktura projektu

```
formForRegistration/
├── manifest.json          # Konfiguracja rozszerzenia
├── background.js          # Logika zarządzania profilami i łańcuchami
├── content.js            # Wypełnianie formularzy i wykrywanie pól
├── popup.html            # Interfejs zarządzania profilami
├── popup.js              # Logika interfejsu użytkownika
├── styles.css            # Style interfejsu
├── create_simple_icons.html # Generator ikon
└── README.md             # Dokumentacja
```

## 🛠️ Instalacja

1. **Pobierz rozszerzenie:**
   ```bash
   git clone https://github.com/JustPrivetProject/fillmicrosoftform.git
   cd fillmicrosoftform
   ```

2. **Załaduj w Chrome:**
   - Otwórz `chrome://extensions/`
   - Włącz "Tryb dewelopera"
   - Kliknij "Załaduj rozpakowane"
   - Wybierz folder projektu

3. **Konfiguracja:**
   - Kliknij ikonę rozszerzenia
   - Utwórz pierwszy profil
   - Skonfiguruj pola do wypełnienia

## 💡 Jak używać

### Tworzenie profilu
1. Kliknij ikonę rozszerzenia
2. Wybierz "Nowy profil"
3. Wprowadź nazwę i opis
4. Dodaj pola do wypełnienia
5. Opcjonalnie wybierz następny profil w łańcuchu
6. Zapisz profil

### Wypełnianie formularzy
1. Otwórz formularz Google
2. Użyj skrótu klawiszowego (np. `Alt+1`) lub
3. Kliknij ikonę rozszerzenia i wybierz profil
4. Rozszerzenie automatycznie wypełni pola

### Łańcuchy profili
1. W edytorze profilu wybierz "Następny profil w łańcuchu"
2. Po wypełnieniu profilu automatycznie uruchomi się następny
3. Proces kontynuuje się aż do końca łańcucha

## 🎯 Typy pól

Rozszerzenie obsługuje następujące typy pól:
- **Tekst** - pola tekstowe, email, telefon
- **Data** - inteligentne wypełnianie dat z formatowaniem
- **Textarea** - wieloliniowe pola tekstowe  
- **Radio** - przyciski opcji z zaawansowanym wyszukiwaniem
- **Checkbox** - pola wyboru
- **Select** - listy rozwijane
- **Button** - automatyczne klikanie przycisków

## 🔧 Zaawansowane funkcje

### XPath Selectors
Rozszerzenie używa zaawansowanych selektorów XPath dla precyzyjnego lokalizowania pól:
```xpath
//span[contains(normalize-space(text()),"Nazwa pola")]//following::input[1]
//label[normalize-space(text())="Nazwa pola"]/following-sibling::input
```

### Ochrona przed cyklami
System automatycznie wykrywa i zapobiega tworzeniu cyklicznych łańcuchów profili, zapewniając bezpieczne wykonywanie.

### Statystyki użycia
Automatyczne śledzenie:
- Liczby użyć każdego profilu
- Ostatniego czasu użycia
- Skuteczności wypełniania

## 🐛 Rozwiązywanie problemów

### Profil nie wypełnia pól
1. Sprawdź czy pola są prawidłowo skonfigurowane
2. Użyj `Ctrl+Shift+D` aby wykryć dostępne pola
3. Sprawdź selektory XPath w konsoli deweloperskiej

### Łańcuch się nie wykonuje
1. Sprawdź czy profil został zapisany z następnym profilem
2. Upewnij się, że nie ma cyklicznych zależności
3. Sprawdź logi w konsoli deweloperskiej

## 🔒 Bezpieczeństwo

- Wszystkie dane są przechowywane lokalnie w przeglądarce
- Brak wysyłania danych do zewnętrznych serwerów  
- Dostęp tylko do stron formularzy Google
- Bezpieczne zarządzanie pamięcią i zasobami

## 🤝 Kontakt

Projekt: [https://github.com/JustPrivetProject/fillmicrosoftform](https://github.com/JustPrivetProject/fillmicrosoftform)

## 📄 Licencja

Ten projekt jest dostępny na licencji MIT. Zobacz plik LICENSE dla szczegółów.

---

**⚡ Zwiększ produktywność wypełniania formularzy z AutoFill!**