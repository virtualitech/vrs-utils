const http = require('http');
const https = require('https');
const FormData = require('form-data');

module.exports = function (config) {
	const { url, headers = {}, text, json, formData, method = 'POST', timeout = 60000, responseType = 'json' } = config;
	const protocol = url.startsWith('https') ? https : http;
	const isMultipart = !!formData;

	let data;

	if (isMultipart) {
		data = new FormData();

		for (var p in formData) {
			const item = formData[p];

			if (typeof item === 'object' && Buffer.isBuffer(item.data)) {
				data.append(p, item.data, { filename: encodeURI(item.name) || 'unknown' });
			}
			else {
				data.append(p, item);
			}
		}

		Object.assign(headers, data.getHeaders());
	}
	else {
		data = json ? JSON.stringify(json, null, 2) : text;
		headers['Content-Type'] = json ? 'application/json' : 'text/plain';
		headers['Content-Length'] = data.length;
	}

	const options = {
		method,
		headers,
		timeout,
		responseType
	};

	return new Promise((resolve, reject) => {
		const req = protocol.request(url, options, (res) => {
			const { statusCode } = res;

			if (statusCode < 200 || statusCode > 299) {
				return reject(new Error(`HTTP status code ${statusCode} ${url}`));
			}

			const body = [];

			res.on('data', (chunk) => body.push(chunk));
			res.on('end', () => {
				try {
					const resString = Buffer.concat(body).toString();

					if (responseType === 'json') {
						const resJson = JSON.parse(resString);
						resolve(resJson);
					}
					else {
						resolve(resString);
					}
				}
				catch (err) {
					reject(err);
				}
			});
		});

		req.on('error', (err) => {
			reject(err);
		});

		req.on('timeout', () => {
			req.destroy();
			reject(new Error(`request TIMEDOUT ${url}`));
		});

		if (isMultipart) {
			data.pipe(req);
		}
		else {
			req.write(data);
			req.end();
		}
	});
}
