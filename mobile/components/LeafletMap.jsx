import { View, StyleSheet, Platform } from "react-native";
import { useRef, useCallback, useEffect } from "react";
import { WebView } from "react-native-webview";

const generateMapHTML = (lat, lng, draggable) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  var marker = L.marker([${lat}, ${lng}], {
    draggable: ${draggable}
  }).addTo(map);

  marker.on('dragend', function() {
    var pos = marker.getLatLng();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'drag',
      latitude: pos.lat,
      longitude: pos.lng
    }));
  });

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'click',
      latitude: e.latlng.lat,
      longitude: e.latlng.lng
    }));
  });
</script>
</body>
</html>
`;

export default function LeafletMap({ region, draggable = true, onPress, onDragEnd, style }) {
  const webViewRef = useRef(null);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'click' && onPress) {
        onPress({ nativeEvent: { coordinate: { latitude: data.latitude, longitude: data.longitude } } });
      } else if (data.type === 'drag' && onDragEnd) {
        onDragEnd({ nativeEvent: { coordinate: { latitude: data.latitude, longitude: data.longitude } } });
      }
    } catch (e) {
      console.warn('LeafletMap message parse error:', e);
    }
  }, [onPress, onDragEnd]);

  const html = generateMapHTML(region.latitude, region.longitude, draggable);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="compatibility"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
