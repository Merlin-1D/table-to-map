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

/**
 * Append a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function appendPre(message) {
    var pre = document.getElementById('content');
    var element = document.createElement('li');
    element.className = 'list-group-item text-break';
    element.innerText = message;
    element.setAttribute('data-bs-toggle', 'modal')
    element.setAttribute('data-bs-target', '#address_info')
    pre.appendChild(element);
}

function listAddresses() {
    let spreadsheet_id = localStorage.getItem('sheet_id');
    let range = localStorage.getItem('range');

    if( spreadsheet_id && range ) {
        gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheet_id,
            range: range,
        }).then(function(response) {
            document.getElementById('content').innerHTML = '';
            var range = response.result;
            if (range.values.length > 0) {
                for (i = 0; i < range.values.length; i++) {
                    var row = range.values[i];
                    // Print columns A and E, which correspond to indices 0 and 4.
                    console.log(row)
                    appendPre(row[0]);
                }
            } else {
                createToast('Потребує уваги', 'У вказаній таблиці не знайдено данні. Оберінь іншу таблицю або межі таблиці')
            }
        }, function(response) {
            createToast('Error', response.result.error.message, false)
        });
    } else {
        createToast('Потребує уваги', 'Оновіть налаштування, щоб побачити список адрес', false)
        document.getElementById('content').innerHTML = '';
    }
}

function loadSettings() {
    let settings = document.querySelectorAll('#settings input');
    settings.forEach(setting => {
        setting.value = localStorage.getItem(setting.name);
    })
}

function updateSettings() {
    let settings = document.querySelectorAll('#settings input');
    settings.forEach(setting => {
        setting.addEventListener('change',(event) => {
            localStorage.setItem (event.target.name, event.target.value);
            listAddresses();
        })
    })
}

document.getElementById('clear_storage').addEventListener('click', () => {
    localStorage.clear();
    loadSettings();
    listAddresses();
})

document.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    updateSettings();
})


var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
})

function createToast(header = '', message = '', autoDismiss = true ) {
    let toastTemplate = document.getElementById('toast_template');
    toastTemplate.removeAttribute('aria-hidden');
    toastTemplate.querySelector('strong').innerText = header;
    toastTemplate.querySelector('.toast-body').innerText = message;
    if (!autoDismiss) {
        toastTemplate.setAttribute('data-bs-autohide', 'false');
    }

    new bootstrap.Toast(toastTemplate).show();
}

// address info modal
var exampleModal = document.getElementById('address_info')
exampleModal.addEventListener('show.bs.modal', function (event) {
    // // Button that triggered the modal
    // var button = event.relatedTarget
    // // Extract info from data-bs-* attributes
    // var recipient = button.getAttribute('data-bs-whatever')
    // // If necessary, you could initiate an AJAX request here
    // // and then do the updating in a callback.
    // //
    // // Update the modal's content.
    // var modalTitle = exampleModal.querySelector('.modal-title')
    // var modalBodyInput = exampleModal.querySelector('.modal-body input')
    //
    // modalTitle.textContent = 'New message to ' + recipient
    // modalBodyInput.value = recipient
})
