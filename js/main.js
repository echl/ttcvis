var globalVariables = {
    scaleFactor: 0,
    maxLon: 0,
    minLon: 0,
    maxLat: 0,
    minLat: 0,
    maxMapY: 0,
    minMapY: 0,
    mapYs: [],
    lats: [],
    lons: [],
    mapMaxWidth: 1024,
    mapMarginSize: 32,
    routeNumbers: ['501', '504', '505', '506', '509', '510', '511', '512'],
    routeDataMap: new Map(),
    isPanning: false,
    mouseDownPoint: {},
    zoomFactor: 0.1,
    stopIconObjectList: [],
    routePointObjectsByRoute: new Map(),
    routePathObjectByRoute: new Map(),
    lineBreakIndicesByRoute: new Map()
};

$('#canvas').mousedown(function (event) {
    globalVariables.isPanning = true;
    globalVariables.mouseDownPoint = new Point(event.offsetX, event.offsetY);

});
$('#canvas').mousemove(function (event) {
    if (globalVariables.isPanning) {
        var mousePoint = new Point(event.offsetX, event.offsetY)
        var deltaVector = mousePoint - globalVariables.mouseDownPoint;
        view.center = view.center - deltaVector;
        globalVariables.mouseDownPoint = mousePoint;
    }
});
$('#canvas').mouseup(function (event) {
    globalVariables.isPanning = false;
});
$('#canvas').mousewheel(function (event) {
    var zoomFactor = (1 - globalVariables.zoomFactor * event.deltaY);
    globalVariables.stopIconObjectList.forEach(function (item) {
        var positionVector = item.position - view.center;
        positionVector = positionVector * zoomFactor;
        var position = positionVector + view.center;
        item.position = position;
    });
    globalVariables.routePointObjectsByRoute.forEach(function (value, key) {
        var routeNumber = key;
        var routePointObjects = value;
        var updatedRoutePointObjects = [];
        // debugger;
        routePointObjects.forEach(function (item) {
            var positionVector = item - view.center;
            positionVector = positionVector * zoomFactor;
            var newPosition = positionVector + view.center;
            item = newPosition;
            updatedRoutePointObjects.push(item);
        });
        globalVariables.routePointObjectsByRoute.set(routeNumber, updatedRoutePointObjects);
        var path = globalVariables.routePathObjectByRoute.get(routeNumber);
        path.remove();
        drawRoutePaths(routeNumber);
    });
});

var promises = globalVariables.routeNumbers.map(function (routeNumber) {
    var url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=ttc&r=' + routeNumber
    return getUrl(url);
});
Promise.all(promises).then(function (resultArray) {
    resultArray.forEach(function (routeNumber) {
        drawRoute(routeNumber);
    });
});

function getUrl(url) {
    return new Promise(function (resolve, reject) {
        var httpRequest, routeData, routeNumber;
        httpRequest = new XMLHttpRequest();
        httpRequest.open('GET', url);
        httpRequest.onload = function () {
            if (httpRequest.status === 200) {
                routeData = getRouteData(httpRequest);
                routeNumber = routeData.getElementsByTagName('route')[0].getAttribute('tag');
                globalVariables.routeDataMap.set(routeNumber, routeData);
                resolve(routeNumber);
            } else {
                alert('There was a problem with the request');
            }
        }
        httpRequest.send();
    });
}

function getRouteData(httpRequest) {
    var response, paths, points, lat, lon, lats, lons;
    lats = globalVariables.lats;
    lons = globalVariables.lons;
    response = httpRequest.responseXML;
    paths = Array.from(response.getElementsByTagName('route')[0].getElementsByTagName('path'));
    paths.forEach(function (item) {
        points = Array.from(item.getElementsByTagName('point'));
        points.forEach(function (item) {
            lat = item.getAttribute('lat');
            lon = item.getAttribute('lon');
            lats.push(lat);
            lons.push(lon);
        });
    });

    return response;
}

function calculateMapScale(lats, lons) {
    globalVariables.maxLon = Math.max.apply(Math, lons);
    globalVariables.minLon = Math.min.apply(Math, lons);
    globalVariables.minLat = Math.min.apply(Math, lats);

    globalVariables.scaleFactor = Math.abs(globalVariables.maxLon - globalVariables.minLon) / (globalVariables.mapMaxWidth - (2 * globalVariables.mapMarginSize));

    lats.forEach(function (item) {
        globalVariables.mapYs.push(Math.abs((item - globalVariables.minLat)) / globalVariables.scaleFactor);
    });

    globalVariables.maxMapY = Math.max.apply(Math, globalVariables.mapYs);
    globalVariables.minMapY = Math.min.apply(Math, globalVariables.mapYs);
}

function drawRoute(routeNumber) {
    var coords = [], stopCoords = [], stopLats = [], stopLons = [], lineBreakIndices = [0], routeData;
    calculateMapScale(globalVariables.lats, globalVariables.lons);
    routeData = globalVariables.routeDataMap.get(routeNumber);
    var paths = Array.from(routeData.getElementsByTagName('route')[0].getElementsByTagName('path'));
    var stops = Array.from(routeData.getElementsByTagName('route')[0].getElementsByTagName('stop'));
    paths.forEach(function (item) {
        var points = Array.from(item.getElementsByTagName('point'));
        lineBreakIndices.push(lineBreakIndices[lineBreakIndices.length - 1] + points.length);
        points.forEach(function (item) {
            var lat = item.getAttribute('lat');
            var lon = item.getAttribute('lon');
            var point = new Point(parseFloat(lon), parseFloat(lat));
            coords.push(point);
        });
    });
    globalVariables.lineBreakIndicesByRoute.set(routeNumber, lineBreakIndices);

    stops.forEach(function (item) {
        var lat = item.getAttribute('lat');
        var lon = item.getAttribute('lon');
        stopLats.push(lat);
        stopLons.push(lon);
        var point = new Point(parseFloat(lon), parseFloat(lat));
        stopCoords.push(point);
    });

    coords.forEach(function (value, index, array) {
        var x = globalVariables.mapMarginSize + Math.abs((value.x - globalVariables.minLon) / globalVariables.scaleFactor);
        var y = Math.abs((value.y - globalVariables.minLat) / globalVariables.scaleFactor);
        y = globalVariables.mapMarginSize + (-y + globalVariables.maxMapY + globalVariables.minMapY);
        array[index] = new Point(x, y);
    });

    stopCoords.forEach(function (value, index, array) {
        var x = globalVariables.mapMarginSize + Math.abs((value.x - globalVariables.minLon) / globalVariables.scaleFactor);
        var y = Math.abs((value.y - globalVariables.minLat) / globalVariables.scaleFactor);
        y = globalVariables.mapMarginSize + (-y + globalVariables.maxMapY + globalVariables.minMapY);
        array[index] = new Point(x, y);
    });

    // var path = new CompoundPath();
    // path.strokeColor = 'red';
    // path.strokeWidth = 1;
    // for (var i = 0; i < lineBreakIndices.length - 2; i++) {
    //     for (var j = lineBreakIndices[i]; j < lineBreakIndices[i + 1]; j++) {
    //         if (j === lineBreakIndices[i]) {
    //             // path.moveTo(coords[j]);
    //         } else {
    //             // path.lineTo(coords[j]);
    //         }
    //         // var circle = new Path.Circle(coords[j], 1);
    //         // circle.strokeColor = 'red';
    //         globalVariables.routePointObjectsByRoute.set(routeNumber, coords[j]);
    //     }
    // }
    globalVariables.routePointObjectsByRoute.set(routeNumber, coords);

    drawRoutePaths(routeNumber);

    stopCoords.forEach(function (item) {
        var circle = new Path.Circle(item, 3);
        globalVariables.stopIconObjectList.push(circle);
        circle.strokeColor = 'black';
        circle.fillColor = 'white';
    });
}

function drawRoutePaths(routeNumber) {
    // debugger;
    console.log("Drawing route paths");
    var lineBreakIndices, routePointObjects, path;
    path = new CompoundPath();
    path.strokeColor = 'red';
    path.strokeWidth = 1;
    lineBreakIndices = globalVariables.lineBreakIndicesByRoute.get(routeNumber);
    routePointObjects = globalVariables.routePointObjectsByRoute.get(routeNumber);
    for (var i = 0; i < lineBreakIndices.length - 2; i++) {
        for (var j = lineBreakIndices[i]; j < lineBreakIndices[i + 1]; j++) {
            if (j === lineBreakIndices[i]) {
                path.moveTo(routePointObjects[j]);
            } else {
                path.lineTo(routePointObjects[j]);
            }
        }
    }
    globalVariables.routePathObjectByRoute.set(routeNumber, path);
    project.activeLayer.insertChild(0, path);
}
