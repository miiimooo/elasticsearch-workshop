'use strict';

// Code adapted from http://www.sitepoint.com/building-recipe-search-site-angular-elasticsearch/

var fs = require('fs');
var elasticsearch = require('elasticsearch');
let client = new elasticsearch.Client({host: 'localhost:9200'});

let indexName = 'openrecipes';
let typeName = 'recipe';

let setupIndex = function() {

  return client.indices.exists({
      index: indexName
    }).then((exists) => {

      if (!exists) {
    // Create an index if it doesn't exist.
    return client.indices.create({
      index: indexName,
      body: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            filtered_ingredients: {
              type: 'standard',
              stopwords: ['to', 'and', 'or', 'with', 'cup', 'cups', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'ounce', 'ounces', 'tablespoon', 'tablespoons', 'tablespons', 'tbsp', 'tbs', 'teaspoon', 'teaspoons', 'tsp', 'pinch', 'taste']
            }
          }
        }
      }
    });
  }
}).then(() => {
  // Put the mapping
  return client.indices.putMapping({
    index: indexName,
    type: typeName,
    body: {
      properties: {
        id: { type: 'string', index: 'not_analyzed' },
        datePublished: {type: 'date'},
        source: { type: 'string', index: 'not_analyzed' },
        url: { type: 'string', index: 'not_analyzed' },
        recipeYield: { type: 'string', index: 'not_analyzed' },
        prepTime: { type: 'string', index: 'not_analyzed' },
        cookTime: { type: 'string', index: 'not_analyzed' },
        name: {
          type: 'string',
          analyzer: 'english'
        },
        description: {
          type: 'string',
          analyzer: 'english'
        },
        ingredients: {
          type: 'string',
          analyzer: 'filtered_ingredients',
        }
      }
    }
  });
}).catch(console.log);
};

let importData = function(filename) {
  fs.readFile(filename, {encoding: 'utf-8'}, function (err, data) {
    if (err) {
      throw err;
    }

    // Build up a giant bulk request for elasticsearch.
    let bulk_request = data.split('\n').reduce(function (bulk_request, line) {
      var obj, recipe;

      try {
        obj = JSON.parse(line);
      } catch (e) {
        console.log('Done reading');
        return bulk_request;
      }

      // Rework the data slightly
      recipe = {
        id: obj._id.$oid, // Was originally a mongodb entry
        name: obj.name,
        source: obj.source,
        url: obj.url,
        recipeYield: obj.recipeYield,
        ingredients: obj.ingredients.split('\n'),
        prepTime: obj.prepTime,
        cookTime: obj.cookTime,
        datePublished: obj.datePublished,
        description: obj.description
      };

      bulk_request.push({index: {_index: indexName, _type: typeName, _id: recipe.id}});
      bulk_request.push(recipe);
      return bulk_request;
    }, []);

    // A little voodoo to simulate synchronous insert
    var busy = false;
    var callback = function (err, resp) {
      if (err) {
        console.log(err);
      }

      busy = false;
    };

    // Recursively whittle away at bulk_request, 1000 at a time.
    var perhaps_insert = function () {
      if (!busy) {
        busy = true;
        client.bulk({
          body: bulk_request.slice(0, 1000)
        }, callback);
        bulk_request = bulk_request.slice(1000);
        console.log(bulk_request.length);
      }

      if (bulk_request.length > 0) {
        setTimeout(perhaps_insert, 10);
      } else {
        console.log('Inserted all records.');
      }
    };

    perhaps_insert();
  });
};

module.exports = {
  indexName: indexName,
  typeName: typeName,
  setupIndex: setupIndex,
  importData: importData,
};