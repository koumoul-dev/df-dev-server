(function() {
  function log (msg, cls) {
    $('<li class="' + (cls || 'info') + '">' + msg + '</li>').appendTo('#log')
  }
  function errorCallback(err) {
    log(err.message || err.responseText || err.statusText || err, 'error');
  }

  var application = window.APPLICATION;
  if (!application) {
    log('Failed to read APPLICATION. You probably did not access this application through a data-fair configuration.', 'error');
    return;
  }
  log('Read APPLICATION: ' + JSON.stringify(application));
  console.log(application.configuration)
  if (!application.configuration || !application.configuration.datasets || !application.configuration.datasets[0]) {
    log('The configuration it not sufficient to display some data.', 'error');
    return;
  }

  $.ajax({url: application.configuration.datasets[0].href + '/lines?size=0', json: true})
    .then(function(data) {
      log('Consumed the API of the configured dataset: ' + JSON.stringify(data))
    })
})();
