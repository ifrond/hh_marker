(function() {
    const EMPLOYER_ID_REGEX = /\/employer\/(\d+)\?/;
    let currentSettings = {
        markerColor: '#ff0000',
        markerText: '(Отказ)'
    };

    // Загрузка настроек
    chrome.storage.sync.get({
        markerColor: '#ff0000',
        markerText: '(Отказ)'
    }, (items) => {
        currentSettings = items;
        updateMarkersStyle();
    });

    // Обработка сообщений
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'updateMarkers') {
            chrome.storage.sync.get(['markerColor', 'markerText'], (items) => {
                currentSettings = items;
                updateMarkersStyle();
                applyMarkers();
            });
        }
        else if (message.action === 'clearMarkers') {
            removeAllMarkers();
        }
    });

    // Обновление стилей маркеров
    function updateMarkersStyle() {
        document.documentElement.style.setProperty(
            '--marker-color',
            currentSettings.markerColor
        );
    }

    // Создание маркера
    function createMarker() {
        const marker = document.createElement('span');
        marker.className = 'hh-marker';
        marker.textContent = currentSettings.markerText;
        marker.title = 'Нажмите, чтобы удалить из списка';
        
        marker.addEventListener('click', (e) => {
            e.preventDefault();
            const employerId = extractEmployerIdFromMarker(marker);
            if (employerId) {
                removeEmployerFromList(employerId);
                marker.remove();
            }
        });

        return marker;
    }

    // Извлечение ID работодателя из маркера
    function extractEmployerIdFromMarker(marker) {
        const link = marker.previousElementSibling;
        if (link && link.href) {
            const match = link.href.match(EMPLOYER_ID_REGEX);
            return match ? match[1] : null;
        }
        return null;
    }

    // Удаление работодателя из списка
    function removeEmployerFromList(employerId) {
        chrome.storage.local.get({storedIds: []}, (result) => {
            const updatedIds = result.storedIds.filter(id => id !== employerId);
            chrome.storage.local.set({storedIds: updatedIds});
            console.log(`Работодатель с ID ${employerId} удален из списка.`);
        });
    }

    // Удаление всех маркеров
    function removeAllMarkers() {
        document.querySelectorAll('.hh-marker').forEach(marker => marker.remove());
        console.log('Все маркеры удалены.');
    }

    // Применение маркеров
    function applyMarkers() {
        chrome.storage.local.get({storedIds: []}, (result) => {
            const storedIds = result.storedIds;
            const employerLinks = document.querySelectorAll(
                'a[data-qa="vacancy-serp__vacancy-employer"]'
            );

            employerLinks.forEach(link => {
                const match = link.href.match(EMPLOYER_ID_REGEX);
                if (match && match[1] && storedIds.includes(match[1])) {
                    if (!link.nextElementSibling?.classList.contains('hh-marker')) {
                        const marker = createMarker();
                        link.parentNode.insertBefore(marker, link.nextSibling);
                        console.log(`Найден и помечен работодатель с ID: ${match[1]}`);
                    }
                }
            });
        });
    }

    // Извлечение ID работодателей из страницы отказов
    function extractEmployerIds() {
        const rejectedSpans = document.querySelectorAll(
            'span[data-qa="negotiations-tag negotiations-item-discard"]'
        );

        const employerIds = new Set();

        rejectedSpans.forEach(span => {
            const header = span.closest('header');
            if (!header) return;

            const section = header.nextElementSibling;
            if (!section || section.tagName !== 'SECTION') return;

            const companyDiv = section.querySelector(
                'div[data-qa="negotiations-item-company"]'
            );
            if (!companyDiv) return;

            let link = companyDiv.parentElement.querySelector('a[href^="/employer/"]');
            if (!link) {
                link = companyDiv.closest('a');
            }
            if (!link) return;

            const match = link.href.match(EMPLOYER_ID_REGEX);
            if (match && match[1]) {
                employerIds.add(match[1]);
                console.log(`Найден ID работодателя: ${match[1]}`);
            }
        });

        return Array.from(employerIds);
    }

    // Отметка работодателя на странице вакансии
    function markEmployerOnVacancyPage(storedIds) {
        const employerLink = document.querySelector(
            'a[data-qa="vacancy-company-name"], a[href*="/employer/"]'
        );

        if (employerLink) {
            const match = employerLink.href.match(EMPLOYER_ID_REGEX);
            if (match && match[1] && storedIds.includes(match[1])) {
                if (!employerLink.nextElementSibling?.classList.contains('hh-marker')) {
                    const marker = createMarker();
                    employerLink.parentNode.insertBefore(marker, employerLink.nextSibling);
                    console.log(`На странице вакансии найден и помечен работодатель с ID: ${match[1]}`);
                }
            } else {
                console.log('Работодатель на странице вакансии не найден в списке отказов.');
            }
        } else {
            console.log('Ссылка на работодателя на странице вакансии не найдена.');
        }
    }

    // Основной поток выполнения
    if (window.location.href.includes('https://hh.ru/applicant/negotiations?filter=all&state=DISCARD')) {
        console.log('Страница отказов: поиск ID работодателей...');
        const ids = extractEmployerIds();
        if (ids.length > 0) {
            chrome.storage.local.get({storedIds: []}, (result) => {
                const existingIds = new Set(result.storedIds);
                const newIds = ids.filter(id => !existingIds.has(id));
                
                if (newIds.length > 0) {
                    chrome.storage.local.set({
                        storedIds: [...result.storedIds, ...newIds]
                    });
                    console.log(`Добавлены новые ID: ${newIds.join(', ')}`);
                } else {
                    console.log('Новых ID не найдено.');
                }
            });
        } else {
            console.log('ID работодателей не найдены на странице.');
        }
    }
    else if (window.location.pathname.includes('/search/vacancy')) {
        console.log('Страница поиска вакансий: поиск работодателей для отметки...');
        chrome.storage.local.get({storedIds: []}, (result) => {
            if (result.storedIds.length > 0) {
                console.log(`Отказники ID: ${result.storedIds.join(', ')}`);
                applyMarkers();
                
                const observer = new MutationObserver(() => {
                    console.log('Обнаружены изменения DOM. Повторная проверка...');
                    applyMarkers();
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } else {
                console.log('Список ID работодателей пуст.');
            }
        });
    }
    else if (window.location.href.includes('https://hh.ru/vacancy/')) {
        console.log('Страница вакансии: поиск работодателя для отметки...');
        chrome.storage.local.get({storedIds: []}, (result) => {
            if (result.storedIds.length > 0) {
                markEmployerOnVacancyPage(result.storedIds);

                // Добавляем MutationObserver для обработки динамической загрузки
                const observer = new MutationObserver(() => {
                    console.log('Обнаружены изменения DOM. Повторная проверка...');
                    markEmployerOnVacancyPage(result.storedIds);
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } else {
                console.log('Список ID работодателей пуст.');
            }
        });
    }
})();