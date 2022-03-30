document.addEventListener('DOMContentLoaded', function () {
    initApp();
})

function initApp() {
    loadSettings();
    updateSettings();

    updateInfoModal();
    // updateAppStatus();

    document.getElementById('clear_storage').addEventListener('click', () => {
        localStorage.clear();
        loadSettings();
        updateAppStatus(true);
    })

    document.getElementById('invalidate_cache').addEventListener('click', () => {
        invalidateCache();
        updateAppStatus(true);
    })

    document.getElementById('filters_form').addEventListener('submit', (e) => {
        e.preventDefault();
        updateAppStatus();
    });
}


// display data
async function updateAppStatus(reload_data) {
    console.log('▶️ Update request')
    let spreadsheet_id = getSetting('sheet_id');
    let range = getSetting('range');

    if (!spreadsheet_id || !range) {
        createToast('Потребує уваги', 'Оновіть налаштування, щоб побачити список адрес')
        document.getElementById('content').innerHTML = '';
        return false;
    }
    let data = await getData(spreadsheet_id, range)
    if (!data) {
        console.log('🙊 No data returned from API...')
        return false;
    }

    if (reload_data) {
        updateDynamicSelects(data);
    }

    data = sortValues(data)
    if (data) {
        printData(data);
    }
}

function printData(values) {
    document.getElementById('content').innerHTML = '';
    values.forEach((row, index) => {
        if (typeof row[0] !== 'undefined') {
            let wrapper = document.getElementById('content');
            let template = document.getElementById('list-group-item')
            let element = template.content.firstElementChild.cloneNode(true);
            element.setAttribute('data-bs-info', JSON.stringify(row));
            element.setAttribute('data-bs-range', index);
            element.querySelector('.message').innerText = row[0].replace(/[\n\r]/g, " ").slice(0, 30);
            element.querySelector('.number').innerText = (typeof row[12] !== 'undefined') ? (row[12] + '/' + row[6]) : row[6];
            element.querySelector('.number').title = (typeof row[12] !== 'undefined') ? (row[12] + ' зайнятих місць з ' + row[6]) : row[6] + ' місць вільно';
            element.querySelector('.time').innerText = (typeof row[7] !== 'undefined') ? row[7].slice(0, 20) : '';
            new bootstrap.Tooltip(element.querySelector('.number'))
            wrapper.appendChild(element);
        }
    })
}

function updateDynamicSelects(data) {
    let dynamic_selects = document.querySelectorAll('.fill_from_data');
    if(dynamic_selects !== null) {
        dynamic_selects.forEach( select => updateFilterData(data, select))
    }
}

function updateFilterData(data, select) {
    if (select === null) {
        return false;
    }
    let row_index = parseFloat(select.getAttribute('data-column-index'));

    // clear options
    select.querySelectorAll('option:not(.dont_remove)').forEach(option => option.remove())

    data = data.map( row => {
        return row[row_index]
    })
    data = [...new Set(data)]
    data.forEach(item => {
        select.add(new Option(item, item));
    })

}

// data storage and transformations
function sortValues(values) {
    let order = document.querySelector('[name="sort-order"]').value;
    let number = parseFloat(document.querySelector('[name="number_of_people"]').value);
    let visibility = document.querySelector('input[name="visibility_setting"]:checked').value; // all/free/busy
    let dynamic_selects = document.querySelectorAll('.fill_from_data');

    // dynamic selects
    if(dynamic_selects !== null) {
        dynamic_selects.forEach( select => {
            if (select.value !== 'all') {
                let row_index = parseFloat(select.getAttribute('data-column-index'));
                values = values.filter(row => {
                    return row[row_index] === select.value;
                });
            }
        })
    }

    // sort order
    if (order !== 'all') {
        values.sort((a, b) => {
            a = typeof a[6] === 'undefined' ? 0 : parseFloat(a[6]);
            b = typeof b[6] === 'undefined' ? 0 : parseFloat(b[6]);
            if (order === 'asc') {
                return a - b;
            } else {
                return b - a;
            }
        });
    }

    // min peoples filter
    if (number > 0) {
        values = values.filter(row => row[6] >= number);
    }

    // visibility filter
    if (visibility !== 'all') {
        switch (visibility) {
            case 'free':
                values = values.filter(row => parseFloat(row[12]) === 0 || isNaN(parseFloat(row[12])));
                break;
            case 'busy':
                values = values.filter(row => parseFloat(row[12]) > 0);
                break
        }
    }
    if (values.length > 0) {
        return values;
    } else {
        createToast('Потребує уваги', 'Не знайдено данних, які відповідають критеріям у фільтрування')
        return false;
    }
}

async function getData(spreadsheet_id, range) {
    try {
        // try to get from cache
        let data = getFromCache();
        return data ? data : await getDataFromAPI(spreadsheet_id, range);
    } catch (error) {
        if (error.status === 403) {
            createToast('Не вдалось відкрити таблицю', 'Ви намагаєтесь отримати доступ до закритого файлу. Щоб переглядати закриті файли увійдіть в аккаут або повторіть спробу (відкрийте меню та натисніть "Оновити кеш кеш")', false)
        } else {
            createToast('🛑Сталась помилка', 'Якщо проблема не вирішилась сама-собою та перешкоджає роботі напишіть розробнику за яких обставин вона виникає', false)
            console.log(error)
        }
        return null;
    }
}

function getFromCache() {
    const MILLISECONDS_TO_MINUTES = 1000 * 60;
    let savedTime = parseFloat(getSetting('cached_time'));
    let now = Date.now();
    let invalidateTime = (getSetting('short_life_cache') === 'true') ? 2 : 10; // minutes

    let isOutdated = isNaN(savedTime) ? true : Math.floor((now - savedTime) / MILLISECONDS_TO_MINUTES) > invalidateTime;
    let raw_data = getSetting('api_cache');

    if (!isOutdated) {
        if (raw_data !== null) {
            let data = JSON.parse(raw_data);
            if (data.length > 0) {
                console.log('⏳ Cache not outdated and have data')
                return data;
            }
        }
        console.log('📭 No data in cache')
    } else {
        console.log('⌛️ Cache is outdated')
    }

    // if we get here that mean cache don't have data
    invalidateCache();
    return false
}

function saveToCache(data) {
    if (getSetting('first_row_names') === 'true') {
        setSetting('names_row', JSON.stringify(data[0]))
        delete data[0]
    }

    data = data.filter(row => row !== null)
    setSetting('api_cache', JSON.stringify(data))
    setSetting('cached_time', Date.now())
    console.log('💾 Cache updated!')
}

function invalidateCache() {
    localStorage.removeItem('api_cache');
    localStorage.removeItem('names_row');
    console.log('🗑️ Delete cache')
}

async function getDataFromAPI(spreadsheet_id, range) {
    let data = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheet_id,
        range: range,
    })
    data = data.result.values
    if (data.length === 0) {
        createToast('Потребує уваги', 'У вказаній таблиці не знайдено данні. Оберінь іншу таблицю або змініть межі таблиці');
        return false;
    } else {
        saveToCache(data)
        data = data.filter(row => row !== null)
        return data;
    }
}

function getSheetLink(index = 0) {
    let range;
    let current_sheet_id = 0;
    let start = getSetting('range').split(':')[0];
    index = ((getSetting('first_row_names') === 'true') ? 1 : 0) + parseFloat(index) + parseFloat(start.match(/\d+/)[0]);
    range = start[0] + index;

    return 'https://docs.google.com/spreadsheets/d/' + getSetting('sheet_id') + '/edit#gid=' + current_sheet_id + '&range=' + range;
}

// settings
function getSetting(name) {
    return localStorage.getItem(name)
}

function setSetting(name, value) {
    return localStorage.setItem(name, value)
}

function loadSettings() {
    let settings = document.querySelectorAll('#settings input');
    settings.forEach(setting => {
        let value = getSetting(setting.name);
        if (setting.matches('[type="checkbox"]')) {
            setting.checked = (value === 'true');
        } else {
            setting.value = value
        }
    });
    console.log('⚙️ Settings loaded')
}

function updateSettings() {
    let settings = document.querySelectorAll('#settings input');
    settings.forEach(setting => {
        setting.addEventListener('change', (event) => {
            let value = event.target.matches('[type="checkbox"]') ? event.target.checked : event.target.value
            setSetting(event.target.name, value);
            console.log('🔧 Settings updated')
            invalidateCache();
            updateAppStatus(true);
        })
    })
}

// UI
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
})

function createToast(header = '', message = '', autoDismiss = true) {
    let toastContainer = document.querySelector('.toast-container');
    let template = document.getElementById('toast_template')
    let toast = template.content.firstElementChild.cloneNode(true);
    toast.querySelector('strong').innerText = header;
    toast.querySelector('.toast-body').innerText = message;
    if (!autoDismiss) {
        toast.setAttribute('data-bs-autohide', 'false');
    }
    toastContainer.appendChild(toast)

    new bootstrap.Toast(toast).show();
}

function updateInfoModal() {
    const addressInfoModal = document.getElementById('address_info')
    addressInfoModal.addEventListener('show.bs.modal', function (event) {
        let row = JSON.parse(event.relatedTarget.getAttribute('data-bs-info'));
        let modal = document.getElementById('address_info');
        let modal_body = modal.querySelector('.modal-body dl');
        let names = getSetting('first_row_names') ? JSON.parse(getSetting('names_row')) : false;
        modal.querySelector('#edit_in_table').setAttribute('href', getSheetLink(event.relatedTarget.getAttribute('data-bs-range')));
        modal_body.innerHTML = ''

        row.forEach((cell, index) => {
            let template = document.getElementById('modal-body-content').content.cloneNode(true);
            if (index === 11) {
                modal_body.appendChild(document.createElement('hr'))
            }
            template.querySelector('dt').textContent = names ? names[index] + ': ' : '';
            template.querySelector('dd').textContent = cell.replace(/[\n\r]/g, " ");
            modal_body.appendChild(template)
        })
    })
}

// client initialization
{
    // Client ID and API key from the Developer Console
    var CLIENT_ID = '242608144188-6ntk3uptkkrtm0v2qaghg20io7852m3o.apps.googleusercontent.com';
    var API_KEY = 'AIzaSyCrkwkW9RqB3Im8mWYrf-spDX3YP9PGQHE';

    // Array of API discovery doc URLs for APIs used by the quickstart
    var DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];

    // Authorization scopes required by the API; multiple scopes can be
    // included, separated by spaces.
    var SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

    var authorizeButton = document.getElementById('authorize_button');
    var signoutButton = document.getElementById('signout_button');

    /**
     *  On load, called to load the auth2 library and API client library.
     */
    function handleClientLoad() {
        gapi.load('client:auth2', initClient);
        console.log('📌 Google API client init')
    }

    /**
     *  Initializes the API client library and sets up sign-in state
     *  listeners.
     */
    function initClient() {
        gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
        }).then(function () {
            updateAppStatus(true);
            // Listen for sign-in state changes.
            gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

            // Handle the initial sign-in state.
            updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
            authorizeButton.onclick = handleAuthClick;
            signoutButton.onclick = handleSignoutClick;
        }, function (error) {
            createToast('Error', error.details, false)
            console.log(error)
        });
    }

    /**
     *  Called when the signed in status changes, to update the UI
     *  appropriately. After a sign-in, the API is called.
     */
    function updateSigninStatus(isSignedIn) {
        authorizeButton.classList.toggle('d-none', isSignedIn)
        signoutButton.classList.toggle('d-none', !isSignedIn)
    }

    /**
     *  Sign in the user upon button click.
     */
    function handleAuthClick(event) {
        gapi.auth2.getAuthInstance().signIn();
    }

    /**
     *  Sign out the user upon button click.
     */
    function handleSignoutClick(event) {
        gapi.auth2.getAuthInstance().signOut();
    }
}

// map and markers
{
    function initMap() {
        const map = new google.maps.Map(document.getElementById("map"), {
            zoom: 7,
            center: {lat: 48.4598343, lng: 31.9950896},
            streetViewControl: false,
            mapTypeControl: false,
        });
        console.log('🗺️ Map init')
        // const marker = new google.maps.Marker({
        //     position: uluru,
        //     map: map,
        // });
    }
}