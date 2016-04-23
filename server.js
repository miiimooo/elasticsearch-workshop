'use strict';

var express = require('express');
var app = express();

const elasticsearch = require('elasticsearch');
let esclient = new elasticsearch.Client({host: 'localhost:9200'});
var url = require('url');


/**
 * The endpoint that will deliver search results.
 */
app.get('/api/search', function (req, res) {

  // Get query parameters
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;

  // If no query was specified, return nothing.
  if (!query.input) {
    res.json({
      total: 0,
      hits: [],
    });
    return;
  }

  /****
   * EDIT THIS PART
   */

  var searchQuery = {
    index: 'openrecipes',

    body: {
      query: {
        bool: {
          must: [
            {
              match: {
                '_all': {
                  query: query.input,
                  operator: 'and'
                }
              }
            }
          ]
        }
      },
      aggs: {
        sources: {
          terms: {
            field: 'source'
          }
        },
        ingredients: {
          terms: {
            field: 'ingredients',
            exclude: query.input + '.*'
          }
        },
      }
    }
  };

  if (query.sources) {
    if (typeof query.sources == 'string') {
      query.sources = [query.sources];
    }
    searchQuery.body.post_filter = {    /////////////<<<<<<<<<<<<<<<<<<<<<<<<<
      terms: {
        source: query.sources
      }
    }
  }

  if (query.ingredients) {
    if (typeof query.ingredients == 'string') {
      query.ingredients = [query.ingredients];
    }
    searchQuery.body.query.bool.must.push({
      match: {
        ingredients: {
          query: query.ingredients.join(' '),
          operator: 'and'
        }
      }
    });
  }

  /****
   * END OF EDITABLE AREA
   ****/

    // Add paging information to the query.
  searchQuery.from = query.from || 0;

  esclient.search(searchQuery).then(function(result) {
    res.json({
      total: result.hits.total,
      hits: result.hits.hits.map((hit) => hit._source),
      sourceFacet: result.aggregations.sources.buckets,
      ingredientsFacet: result.aggregations.ingredients.buckets
  });
}).catch(console.log)
});


/**
 * The endpoint that will deliver search suggestions.
 */
app.get('/api/suggest', function (req, res) {

  // Get query parameters
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;

  // If no query was specified, return nothing.
  if (!query.input) {
    res.json([]);
    return;
  }

  var searchQuery = {
    index: 'openrecipes',
    size: 0,
    body: {
      query: {
        prefix: {
          ingredients: query.input
        }
      },
      aggs: {
        ingredients: {
          terms: {
            field: 'ingredients',
            include: query.input + '.*'
          }
        },
      }
    }
  };

  /****
   * END OF EDITABLE AREA
   ****/

    // Add paging information to the query.
  searchQuery.from = query.from || 0;

  esclient.search(searchQuery).then(function(result) {
    res.json(result.aggregations.ingredients.buckets.map((bucket) => ({label: bucket.key})));
  }).catch(console.log)
});

app.use(express.static('public'));
app.use(express.static('node_modules/bootstrap/dist'));
app.use(express.static('node_modules/angular'));
app.use(express.static('node_modules/angular-aria'));
app.use(express.static('node_modules/angular-animate'));
app.use(express.static('node_modules/angular-material'));
app.use(express.static('node_modules/angular-messages'));
app.use(express.static('node_modules/angular-resource'));


app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
