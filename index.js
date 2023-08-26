const express = require('express');
const request = require('request');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const app = express();
const port = 3000;

const cache = new NodeCache({ stdTTL: 600 }); // Cache TTL set to 10 minutes

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
};

function getFinalRedirectedUrl(initialUrl) {
    return new Promise((resolve, reject) => {
        request.get({ url: initialUrl, headers, followRedirect: false }, (error, response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                resolve(response.headers.location);
            } else {
                resolve(initialUrl);
            }
        });
    });
}

function scrapeAndGenerateLinks() {
    return new Promise((resolve, reject) => {
        const cachedLinks = cache.get('links');
        if (cachedLinks) {
            resolve(cachedLinks);
            return;
        }

        request.get({ url: 'https://xgroovy.com/gifs/', headers }, (error, response, body) => {
            if (error) {
                reject(error);
                return;
            }
            
            const $ = cheerio.load(body);
            const gifDivs = $('.gif-wrap');
            const matchingLinks = gifDivs.map((_, div) => $(div).attr('data-full')).get();

            Promise.all(matchingLinks.map(link => getFinalRedirectedUrl(link)))
                .then(finalRedirectedLinks => {
                    const result = finalRedirectedLinks.map(link => ({ url_vid: link }));
                    cache.set('links', result); // Cache the result
                    resolve(result);
                })
                .catch(reject);
        });
    });
}

app.get('/', (req, res) => {
    scrapeAndGenerateLinks()
        .then(linksResult => {
            res.json(linksResult); // Send JSON response
        })
        .catch(error => {
            console.error('Error:', error);
            res.status(500).json({ error: 'An error occurred.' }); // Send JSON error response
        });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
