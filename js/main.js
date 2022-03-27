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
        updateAppStatus();
    })

    document.getElementById('invalidate_cache').addEventListener('click', () => {
        invalidateCache();
        updateAppStatus();
    })

    document.getElementById('filters_form').addEventListener('submit', (e) => {
        e.preventDefault();
        updateAppStatus();
    });
}


// display data
function updateAppStatus() {
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
}

async function listAddresses() {
    let spreadsheet_id = getSetting('sheet_id');
    let range = getSetting('range');

    if (spreadsheet_id && range) {
        let values = await getData(spreadsheet_id, range)
        printData(sortValues(values));
    } else {
        createToast('Потребує уваги', 'Оновіть налаштування, щоб побачити список адрес', false)
        document.getElementById('content').innerHTML = '';
    }
}

function printData(values) {
    document.getElementById('content').innerHTML = '';
    if (values.length > 0) {
        values.forEach( ( row, index ) => {
            if (typeof row[0] !== 'undefined') {
                appendData(row, index)
            }
        })
    } else {
        createToast('Потребує уваги', 'Не знайдено данних, які відповідають критеріям у фільтрування')
    }
}

// data storage and transformations
function sortValues(values) {
    let order = document.querySelector('[name="sort-order"]').value;
    let number = parseFloat(document.querySelector('[name="number_of_people"]').value);
    let visibility = document.querySelector('input[name="visibility_setting"]:checked').value; // all/free/busy

    // sort order
    if (order !== 'none') {
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

    return values;
}

async function getData(spreadsheet_id, range) {
    const always_update = getSetting('always_update') === 'true';
    let data;

    try {
        if (!always_update) {
            let raw_data = getSetting('api_cache');
            console.log(raw_data)
            if (raw_data !== null) {
                data = JSON.parse(raw_data);
                console.log(data, raw_data)
                if (data.length > 0) {
                    return data;
                }
            }
        }
        data = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheet_id,
            range: range,
        })
        // data = data.result.values.filter(row => typeof row[0] !== 'undefined'); // збивається індекс клітинок
        data = data.result.values
        if (data.length === 0) {
            createToast('Потребує уваги', 'У вказаній таблиці не знайдено данні. Оберінь іншу таблицю або межі таблиці')
        }
        if (getSetting('first_row_names') === 'true') {
            setSetting('names_row', JSON.stringify(data[0]))
            delete data[0]
        }

        data = data.filter(row => row !== null)
        setSetting('api_cache', JSON.stringify(data))
        return data;
    } catch (error) {
        createToast('Error', error, false)
        console.log(error)
    }
}

function invalidateCache() {
    localStorage.removeItem('api_cache');
    localStorage.removeItem('names_row');
}

function getSheetLink(index= 0) {
    let range;
    let start = getSetting('range').split(':')[0];
    index = ( ( getSetting('first_row_names') === 'true' ) ? 1 : 0 ) + parseInt(index) + parseInt(start.match(/\d+/)[0]) + 1;
    range = start[0] + index;
    return 'https://docs.google.com/spreadsheets/d/'+getSetting('sheet_id')+'/edit#gid=0&range=' + range;
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
            updateAppStatus();
        })
    })
}

// UI
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
})

function appendData(row, range = '') {
    let wrapper = document.getElementById('content');
    let template = document.getElementById('list-group-item')
    let element = template.content.firstElementChild.cloneNode(true);
    element.setAttribute('data-bs-info', JSON.stringify(row));
    element.setAttribute('data-bs-range', range);
    element.querySelector('.message').innerText = row[0].replace(/[\n\r]/g, " ");
    element.querySelector('.number').innerText = (typeof row[12] !== 'undefined') ? (row[12] + '/' + row[6]) : row[6];
    element.querySelector('.number').title = (typeof row[12] !== 'undefined') ? (row[12] + ' зайнятих місць з ' + row[6]) : row[6] + ' місць вільно';
    element.querySelector('.time').innerText = row[7];
    new bootstrap.Tooltip(element.querySelector('.number'))
    wrapper.appendChild(element);
}

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
            if (!names) {
                template.querySelector('dt').classList.add('d-none')
            }
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
        console.log('📌 Client init')
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
            // Listen for sign-in state changes.
            gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

            // Handle the initial sign-in state.
            updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
            authorizeButton.onclick = handleAuthClick;
            signoutButton.onclick = handleSignoutClick;
        }, function (error) {
            createToast('Error', error.details, false)
        });
    }

    /**
     *  Called when the signed in status changes, to update the UI
     *  appropriately. After a sign-in, the API is called.
     */
    function updateSigninStatus(isSignedIn) {
        authorizeButton.classList.toggle('d-none', isSignedIn)
        signoutButton.classList.toggle('d-none', !isSignedIn)
        if (isSignedIn) {
            listAddresses();
        } else {
            createToast('Потребує уваги', 'Щоб переглядати файли необхідно увійти в додаток')
        }
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


