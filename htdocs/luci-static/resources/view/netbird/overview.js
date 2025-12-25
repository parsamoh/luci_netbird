'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			callServiceList('netbird'),
			fs.exec('/usr/bin/netbird', [ 'status', '-d' ])
		]);
	},

	render: function(data) {
		var serviceStatus = data[0]['netbird'] || {};
		var netbirdStatusRaw = data[1].code === 0 ? data[1].stdout : null;

		var isRunning = serviceStatus.instances && serviceStatus.instances.instance1 && serviceStatus.instances.instance1.running;

		var statusTable = E('table', { 'class': 'table' }, [
			E('tr', [
				E('td', { 'width': '33%' }, 'Service Status'),
				E('td', isRunning ? E('span', { 'class': 'label success' }, 'Running') : E('span', { 'class': 'label' }, 'Stopped'))
			]),
			E('tr', [
				E('td', 'NetBird Status'),
				E('td', (function() {
					if (!netbirdStatusRaw) return E('em', 'Not available');
					var match = netbirdStatusRaw.match(/Daemon status:\s+(\w+)/);
					return match ? match[1] : 'Unknown';
				})())
			])
		]);

		var toggleBtn = E('button', {
			'class': 'cbi-button cbi-button-' + (isRunning ? 'reset' : 'apply'),
			'click': ui.createHandlerFn(this, function() {
				return fs.exec('/etc/init.d/netbird', [ isRunning ? 'stop' : 'start' ]).then(function(res) {
					if (res.code === 0) {
						ui.addNotification(null, E('p', 'Service ' + (isRunning ? 'stopped' : 'started') + ' successfully.'));
						location.reload(); 
					} else {
						ui.addNotification(null, E('p', 'Failed to ' + (isRunning ? 'stop' : 'start') + ' service.'), 'error');
					}
				});
			})
		}, [ isRunning ? 'Stop Service' : 'Start Service' ]);

		var peersTable = E('table', { 'class': 'table' }, [
			E('tr', [
				E('th', 'Hostname'),
				E('th', 'IP'),
				E('th', 'Status')
			])
		]);

		if (netbirdStatusRaw) {
			var lines = netbirdStatusRaw.split('\n');
			var peersStarted = false;
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i].trim();
				if (line.startsWith('Peers detail:') || line.startsWith('Peers:')) {
					peersStarted = true;
					continue;
				}
				if (peersStarted && line !== '') {
					// Example line: "office-router (100.x.x.x): Connected" or similar
                    // Adjusting regex to be flexible
                    // Assuming format: <hostname> (<ip>): <status>
					var parts = line.match(/^(.+?)(?:\s+\((.+?)\))?:\s+(.+)$/);
					if (parts) {
						peersTable.appendChild(E('tr', [
							E('td', parts[1] || '?'),
							E('td', parts[2] || '-'),
							E('td', parts[3])
						]));
					} else {
                         // Fallback for simple list or different format
                         peersTable.appendChild(E('tr', [ E('td', { 'colspan': 3 }, line) ]));
                    }
				}
			}
		}

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', 'NetBird'),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', 'Service Status'),
				statusTable,
				E('div', { 'class': 'cbi-section-node' }, [ toggleBtn ])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', 'Connected Peers'),
				peersTable
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
