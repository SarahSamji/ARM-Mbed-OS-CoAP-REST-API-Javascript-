require('dotenv').config({ silent: false }); // Retrieve options from .env

var websockets = require('socket.io'); // Use WebSockets
var http = require('http'); // Basic HTTP functionality
var path = require('path'); // Parse directory paths
var express = require('express'); // Provide static routing to pages
var mbedAPI = require('mbed-connector-api'); // Communicate with the uC

// Get data from the env file (port is the only one optional)
var accessKey = process.env.ACCESS_KEY;
var endpoint = process.env.ENDPOINT;
var port = process.env.PORT || 8080;

// Setup the other libraries that need to run
var mbed = new mbedAPI({ accessKey: accessKey });
var app = setupExpress();

// Two callbacks are defined:
// - The first is called every time a new client connects
//	 This is when a user loads the webpage
// - The second is called when the mbed Device Connector sends a notification
//   This happens when you tell mbed to notify you of changes to GET params
	
	//Subscribe to changes in API endpoint

			mbed.putResourceSubscription(endpoint, '3318/0/5900', function (err,subscribed)
			 {
	 			if(err)
	 				throw err;

	 			console.log('Subscribe to 5900' + subscribed);
			 });
	 
			 mbed.putResourceSubscription(endpoint, '3318/0/5601', function(error, subscribed)
			 {
				if (error)
					throw error;

				console.log('Subscribe to 5601' + subscribed); 
			});

			mbed.putResourceSubscription(endpoint, '3318/0/5602', function(error, subscribed)
			{
				if (error)
					throw error;

				console.log('subscribed to 5602' + subscribed); 
			});

listen(function(socket)
{

	// A new user has connected
	// Use the socket to communicate with them
	socket.on('get-bpm', function()
	{
			mbed.getResourceValue(endpoint, '3318/0/5900', function(err, data)
			{
				if (err)
					throw err;

					socket.emit('bpm', {value: data});	
			});

			mbed.getResourceValue(endpoint, '3318/0/5601', function(err,data)
			{

				if(err)
					throw err;

				socket.emit('min', {value: data});		
			});

			mbed.getResourceValue(endpoint, '3318/0/5602', function(err,data)
			{

				if(err)
					throw err;

				socket.emit('max', {value: data});		
			});
		
			 
	});

	//Put new BPM value
	socket.on('bpm_put', function(data)
	{
 		// process.stdout.write(data.value);
 		 console.log('value to put is ' + data.value);

 			 mbed.putResourceValue(endpoint,'3318/0/5900', data.value, function(err)
			{	
				if(err)
					throw err;
				 //console.log('Set new bpm',endpoint, 'to new bpm!');
			
			});
 	});

	
	//Reset min/max BPM values
	socket.on('reset_minmax', function()
	{
		//TODO - get min , max value too
		mbed.postResource(endpoint, '3318/0/5605', function(err)
		{
			if (err)
				throw err;

		});		

			/*var reset=0;
		 console.log('value to put is ' + reset);

 			 mbed.putResourceValue(endpoint,'3318/0/5601', reset, function(err)
			{	
				if(err)
					throw err;
							
			});
 			  console.log('value to put is ' + reset);
 			  mbed.putResourceValue(endpoint,'3318/0/5602', reset, function(err)
			{	
				if(err)
					throw err;
							
			});*/

	});
	

}, function(socket, notification)
	{
		mbed.on('notification', function(notification) 
		{
  			console.log('Got a notification', notification);
  			socket.emit('notification', {value:notification});

  		});
	
	// An API endpoint has been updated, and Device Connector is telling us
	// Use the socket to relay the notification to the currently connected users
});

// Handle routing of pages
// There is only one (besides error), so not much occurs here
function setupExpress()
{
	// HTML files located here
	var viewsDir = path.join(__dirname, 'views');
	// JS/CSS support located here
	// This becomes the root directory used by the HTML files
	var publicDir = path.join(__dirname, 'public');

	var app = express();
	app.use(express.static(publicDir));

	// Get the index page (only option)
	app.get('/', function(req, res)
	{
		res.sendFile('views/index.html', { root: '.' });
	});

	// Handle any misc errors by redirecting to a simple page and logging
	app.use(function(err, req, res, next)
	{
		console.log(err.stack);
		res.status(err.status || 500);

		res.sendFile('/views/error.html', { root: '.' });
	});

	return app;
}

function listen(user_callback, mbed_callback)
{
	// Prepare to keep track of all connected users and sockets
	var sockets = [];
	var server = http.Server(app);
	var io = websockets(server);

	/* mbed.getResourceSubscription(endpoint, '3318/0/5900', function (err,subscribed)
	 {
	 	if(err)
	 		throw err;
	 	assert(true);
	 });*/

	 

	// A new user has connected
	io.on('connection', function(socket)
	{
		// Track them
		sockets.push(socket);
		// Call the function you specified
		user_callback(socket);
	});

	// A GET endpoint has changed
	mbed.on('notification', function(notification)
	{
		
		// Notify all users about the change
		sockets.forEach(function(socket)
		{
			mbed_callback(socket, notification);
		});
	});

	// Begin waiting for connections
	server.listen(port, function()
	{
		// Use long polling, else all responses are async
		mbed.startLongPolling(function(err)
		{
			if (err)
				throw err;

			console.log('listening at http://localhost:%s', port);
		});
	});
}
