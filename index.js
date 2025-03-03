(function ($, L, prettySize) {
  var map,
    heat,
    heatOptions = {
      tileOpacity: 1,
      heatOpacity: 1,
      radius: 25,
      blur: 15,
    };

  function status(message) {
    $("#currentStatus").text(message);
  }
  // Start at the beginning
  stageOne();

  function stageOne() {
    var dropzone;

    // Initialize the map
    map = L.map("map").setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        'location-history-visualizer is open source and available <a href="https://github.com/theopolisme/location-history-visualizer">on GitHub</a>. Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors.',
      maxZoom: 18,
      minZoom: 2,
    }).addTo(map);

    // Initialize the dropzone
    dropzone = new Dropzone(document.body, {
      url: "/",
      previewsContainer: document.createElement("div"), // >> /dev/null
      clickable: false,
      accept: async function (file, done) {
        await stageTwo(file);
        dropzone.disable(); // Your job is done, buddy
      },
    });

    // For mobile browsers, allow direct file selection as well
    $("#file").change(function () {
      stageTwo(this.files[0]);
      dropzone.disable();
    });
  }

  var latlngs = [];

  async function stageTwo(file) {
    heat = L.heatLayer([], heatOptions).addTo(map);

    var type;

    try {
      if (/\.kml$/i.test(file.name)) {
        type = "kml";
      } else {
        type = "json";
      }
    } catch (ex) {
      status(
        "Something went wrong generating your map. Ensure you're uploading a Google Takeout JSON file that contains location data and try again, or create an issue on GitHub if the problem persists. ( error: " +
          ex.message +
          " )"
      );
      return;
    }

    // First, change tabs
    $("body").addClass("working");
    $("#intro").addClass("hidden");
    $("#working").removeClass("hidden");

    var SCALAR_E7 = 0.0000001; // Since Google Takeout stores latlngs as integers

    var os = new oboe();

    os.node("{point time}", function (location) {
      const regex = /(-?\d+\.\d+)\u00B0,\s*(-?\d+\.\d+)\u00B0/;
      const match = location["point"].match(regex);
      if (!match) {
        console.log("no match", regex, location["point"]);
        return;
        return oboe.drop;
      }
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);

      // Handle negative latlngs due to google unsigned/signed integer bug.
      // if ( latitude > 180 ) latitude = latitude - (2 ** 32) * SCALAR_E7;
      // if ( longitude > 180 ) longitude = longitude - (2 ** 32) * SCALAR_E7;

      if (type === "json" && !isNaN(latitude) && !isNaN(longitude)) {
        // console.log("adding point", latitude, longitude)
        latlngs.push([latitude, longitude]);
      } else {
        console.log("something wrong", latitude, longitude);
      }
      return;
      return oboe.drop;
    }).done(function () {
      status("Generating map...");
      heat._latlngs = latlngs;

      heat.redraw();
      stageThree(/* numberProcessed */ latlngs.length);
    });

    var fileSize = prettySize(file.size);

    status("Preparing to import file ( " + fileSize + " )...");

    // Now start working!
    if (type === "json") await parseJSONFile(file, os);
    if (type === "kml") parseKMLFile(file);
  }

  function stageThree(numberProcessed) {
    var $done = $("#done");

    // Change tabs :D
    $("body").removeClass("working");
    $("#working").addClass("hidden");
    $done.removeClass("hidden");

    // Update count
    $("#numberProcessed").text(numberProcessed.toLocaleString());

    $("#launch").click(function () {
      $(this).text("Launching... ");
      $("body").addClass("map-active");
      $done.fadeOut();
      activateControls();
    });

    function activateControls() {
      var $tileLayer = $(".leaflet-tile-pane"),
        $heatmapLayer = $(".leaflet-heatmap-layer"),
        originalHeatOptions = $.extend({}, heatOptions); // for reset

      // Update values of the dom elements
      function updateInputs() {
        var option;
        for (option in heatOptions) {
          if (heatOptions.hasOwnProperty(option)) {
            document.getElementById(option).value = heatOptions[option];
          }
        }
      }

      updateInputs();

      $(".control").change(function () {
        switch (this.id) {
          case "tileOpacity":
            $tileLayer.css("opacity", this.value);
            break;
          case "heatOpacity":
            $heatmapLayer.css("opacity", this.value);
            break;
          default:
            heatOptions[this.id] = Number(this.value);
            heat.setOptions(heatOptions);
            break;
        }
      });

      $("#reset").click(function () {
        $.extend(heatOptions, originalHeatOptions);
        updateInputs();
        heat.setOptions(heatOptions);
        // Reset opacity too
        $heatmapLayer.css("opacity", originalHeatOptions.heatOpacity);
        $tileLayer.css("opacity", originalHeatOptions.tileOpacity);
      });
    }
  }

  /*
	Break file into chunks and emit 'data' to oboe instance
	*/

  async function parseJSONFile(file, oboeInstance) {
    // Read the file and parse it as JSON
    const fileContent = await file.text();
    const jsonData = JSON.parse(fileContent);

    // Recursive function to traverse JSON and process matching objects
    function traverse(obj) {
      if (obj && typeof obj === "object") {
        if (obj.hasOwnProperty("startTime")) {
          const date = new Date(obj["startTime"]);
          const year = date.getFullYear();
          const month = date.getMonth();
          // do date filtering here
        }
        // Check if the object has "point" and "location" properties
        if (obj.hasOwnProperty("placeLocation")) {
          const regex = /geo:([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/;
          const match = obj["placeLocation"].match(regex);
          if (!match) {
            console.log("no match", regex, obj["placeLocation"]);
            return;
          }
          const latitude = parseFloat(match[1]);
          const longitude = parseFloat(match[2]);

          // Handle negative latlngs due to google unsigned/signed integer bug.
          // if ( latitude > 180 ) latitude = latitude - (2 ** 32) * SCALAR_E7;
          // if ( longitude > 180 ) longitude = longitude - (2 ** 32) * SCALAR_E7;

          if (!isNaN(latitude) && !isNaN(longitude)) {
            // console.log("adding point", latitude, longitude)
            latlngs.push([latitude, longitude]);
          } else {
            console.log("something wrong", latitude, longitude);
          }
        }
        // Recursively check all nested objects
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && typeof obj[key] === "object") {
            traverse(obj[key]);
          }
        }
      }
    }

    // Start the traversal
    traverse(jsonData);

    status("Generating map...");
    heat._latlngs = latlngs;

    heat.redraw();
    console.log("# of points", latlngs.length);
    stageThree(/* numberProcessed */ latlngs.length);

    if (0) {
      var fileSize = file.size;
      var prettyFileSize = prettySize(fileSize);
      var chunkSize = 512 * 1024; // bytes
      var offset = 0;
      var chunkReaderBlock = null;
      var readEventHandler = function (evt) {
        if (evt.target.error == null) {
          offset += evt.target.result.length;
          var chunk = evt.target.result;
          var percentLoaded = ((100 * offset) / fileSize).toFixed(0);
          status(percentLoaded + "% of " + prettyFileSize + " loaded...");
          oboeInstance.emit("data", chunk); // callback for handling read chunk
        } else {
          return;
        }
        if (offset >= fileSize) {
          //oboeInstance.emit( 'done' );
          status("Generating map...");
          heat._latlngs = latlngs;

          heat.redraw();
          console.log("# of points", latlngs.length);
          stageThree(/* numberProcessed */ latlngs.length);
          return;
        }

        // of to the next chunk
        chunkReaderBlock(offset, chunkSize, file);
      };

      chunkReaderBlock = function (_offset, length, _file) {
        var r = new FileReader();
        var blob = _file.slice(_offset, length + _offset);
        r.onload = readEventHandler;
        r.readAsText(blob);
      };

      // now let's start the read with the first block
      chunkReaderBlock(offset, chunkSize, file);
    }
  }

  /*
        Default behavior for file upload (no chunking)	
	*/

  function parseKMLFile(file) {
    var fileSize = prettySize(file.size);
    var reader = new FileReader();
    reader.onprogress = function (e) {
      var percentLoaded = Math.round((e.loaded / e.total) * 100);
      status(percentLoaded + "% of " + fileSize + " loaded...");
    };

    reader.onload = function (e) {
      var latlngs;
      status("Generating map...");
      latlngs = getLocationDataFromKml(e.target.result);
      heat._latlngs = latlngs;
      heat.redraw();
      stageThree(latlngs.length);
    };
    reader.onerror = function () {
      status(
        'Something went wrong reading your JSON file. Ensure you\'re uploading a "direct-from-Google" JSON file and try again, or create an issue on GitHub if the problem persists. ( error: ' +
          reader.error +
          " )"
      );
    };
    reader.readAsText(file);
  }

  function getLocationDataFromKml(data) {
    var KML_DATA_REGEXP =
        /<when>( .*? )<\/when>\s*<gx:coord>( \S* )\s( \S* )\s( \S* )<\/gx:coord>/g,
      locations = [],
      match = KML_DATA_REGEXP.exec(data);

    // match
    //  [ 1 ] ISO 8601 timestamp
    //  [ 2 ] longitude
    //  [ 3 ] latitude
    //  [ 4 ] altitude ( not currently provided by Location History )
    while (match !== null) {
      locations.push([Number(match[3]), Number(match[2])]);
      match = KML_DATA_REGEXP.exec(data);
    }

    return locations;
  }
})(jQuery, L, prettySize);
