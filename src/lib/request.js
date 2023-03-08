const http = require('http');
const https = require('https');
const FormData = require('form-data');
const { parse: htmlParser } = require('node-html-parser');
const { parse: jsonParser } = JSON;

module.exports = function (config) {
	const {
		url,
		headers = {},
		text,
		json,
		formData,
		method = 'post',
		timeout = 60000,
		responseType = 'json',
		returnHeaders = false
	} = config;

	const protocol = url.startsWith('https') ? https : http;
	const isMultipart = !!formData;
	const isPost = method.toLowerCase() === 'post' || method.toLowerCase() === 'put';

	let data;

	if (isPost) {
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
		else if (json) {
			data = JSON.stringify(json, null, 2);
			headers['Content-Type'] = 'application/json';
		} else {
			data = text;
			headers['Content-Type'] = 'text/plain';
		}

		if (data) {
			headers['Content-Length'] = data.length;
		}
	}

	const options = {
		method,
		headers,
		timeout,
		responseType
	};

	return new Promise((resolve, reject) => {
		const req = protocol.request(url, options, (res) => {
			const { statusCode, headers } = res;

			if (statusCode < 200 || statusCode > 299) {
				return reject(new Error(`HTTP status code ${statusCode} ${url}`));
			}

			const body = [];

			res.on('data', (chunk) => body.push(chunk));
			res.on('end', () => {
				try {
					const resString = Buffer.concat(body).toString();
					let data;

					if (responseType === 'json') {
						data = jsonParser(resString);
					}
					else if (responseType === 'html') {
						data = htmlParser(resString);
					}
					else {
						data = resString;
					}

					if (returnHeaders) {
						resolve({ data, headers });
					} else {
						resolve(data);
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

		if (isPost) {
			if (isMultipart) {
				data.pipe(req);
			}
			else {
				req.write(data);
				req.end();
			}
		} else {
			req.end();
		}
	});
}
