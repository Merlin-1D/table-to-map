document.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    updateSettings();

    document.getElementById('clear_storage').addEventListener('click', () => {
        localStorage.clear();
        loadSettings();
        listAddresses();
    })

    document.getElementById('invalidate_cache').addEventListener('click', () => {
        localStorage.removeItem('api_cache');
        listAddresses();
    })

    document.getElementById('filters_form').addEventListener('submit', (e) => {
        e.preventDefault();
        listAddresses();
    } );
})


// display data
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
    if (values.length > 0) {
        document.getElementById('content').innerHTML = '';
        values.forEach(row => {
            appendData(row);
        })
    } else {
        createToast('Потребує уваги', 'У вказаній таблиці не знайдено данні. Оберінь іншу таблицю або межі таблиці')
    }
}

function appendData(row) {
    let wrapper = document.getElementById('content');
    let template = document.getElementById('list-group-item')
    let element = template.content.cloneNode(true);
    element.querySelector('[data-bs-info]').setAttribute('data-bs-info', JSON.stringify(row));
    element.querySelector('.message').innerText = row[0].replace(/[\n\r]/g, " ");
    element.querySelector('.number').innerText = row[6];
    element.querySelector('.time').innerText = row[7];
    wrapper.appendChild(element);
}

// address info modal
var exampleModal = document.getElementById('address_info')
exampleModal.addEventListener('show.bs.modal', function (event) {
    let row = JSON.parse(event.relatedTarget.getAttribute('data-bs-info'));
    let modal = document.getElementById('address_info');
    let modal_body = modal.querySelector('.modal-body');

    row.forEach( cell => {
        let node = document.createElement('p');
        node.innerText = cell.replace(/[\n\r]/g, " ");
        modal_body.appendChild(node)
    })
})

// data storage and transformations
function sortValues(values) {
    let order = document.querySelector('[name="sort-order"]').value;
    let number = parseFloat(document.querySelector('[name="number_of_people"]').value);
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

    if (number > 0) {
        values = values.filter(row => row[6] >= number);
    }
    return values;
}

async function getData(spreadsheet_id, range) {
    const always_update = getSetting('always_update') === 'true';
    let data;

    try {
        if (!always_update) {
            data = JSON.parse(getSetting('api_cache'));

            if ( typeof data !== 'undefined' && data.length > 0) {
                return data;
            }
        }
        data = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheet_id,
            range: range,
        });
        data = data.result.values.filter(row => typeof row[0] !== 'undefined');
        setSetting('api_cache', JSON.stringify(data))
        return data;
    } catch (response) {
        createToast('Error', response.result.error.message, false)
        console.log(response.result.error)
    }
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
    })
}

function updateSettings() {
    let settings = document.querySelectorAll('#settings input');
    settings.forEach(setting => {
        setting.addEventListener('change',(event) => {
            let value = event.target.matches('[type="checkbox"]') ? event.target.checked : event.target.value
            setSetting(event.target.name, value);
            listAddresses();
        })
    })
}

// interface
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
})

function createToast(header = '', message = '', autoDismiss = true) {
    let toastTemplate = document.getElementById('toast_template');
    toastTemplate.removeAttribute('aria-hidden');
    toastTemplate.querySelector('strong').innerText = header;
    toastTemplate.querySelector('.toast-body').innerText = message;
    if (!autoDismiss) {
        toastTemplate.setAttribute('data-bs-autohide', 'false');
    }

    new bootstrap.Toast(toastTemplate).show();
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
        }, function(error) {
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
            createToast('Потребує уваги', 'Щоб розпочати необхідно увійти в додаток', false)
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
            center: { lat: 48.4598343, lng: 31.9950896 },
            streetViewControl: false,
            mapTypeControl: false,
        });
        // const marker = new google.maps.Marker({
        //     position: uluru,
        //     map: map,
        // });
    }
}


