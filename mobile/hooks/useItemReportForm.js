import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import * as Location from "expo-location";
import * as ImagePicker from 'expo-image-picker';
import { useImageUpload } from './useImageUpload';

/**
 * Shared hook for both report-found and report-lost forms
 * Handles location, image upload, location search, and form validation
 */
export const useItemReportForm = (initialType = 'LOST') => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    date: new Date(),
    showDatePicker: false,
    category: '',
    brandName: '',
    color: '',
    image: null,
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [coords, setCoords] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
  });
  const [locationError, setLocationError] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const debounceTimerRef = useRef(null);

  const { uploadImage } = useImageUpload();

  // Get current location on mount (if permission granted)
  useEffect(() => {
    (async () => {
      try {
        // Check current permission status first (doesn't show prompt)
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        
        let status = existingStatus;
        
        // Only request if not determined yet
        if (existingStatus === 'undetermined') {
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          status = newStatus;
        }

        if (status !== "granted") {
          setLocationError("Location access not granted. You can manually enter location or enable it in settings.");
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
        });

        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });

        // Get address from coordinates
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });
          
          if (addresses.length > 0) {
            const address = addresses[0];
            const locationName = `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
            handleInputChange('location', locationName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          } else {
            handleInputChange('location', `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (geocodeError) {
          if (__DEV__) console.log("Geocoding error:", geocodeError);
          handleInputChange('location', `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      } catch (error) {
        console.error("Location error:", error);
        setLocationError("Could not get your location. Please enter it manually.");
      }
    })();
  }, []);

  // Pick image from library
  const pickImage = async () => {
    try {
      // Request permission just-in-time
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please grant photo library access to upload images. You can change this in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        setError('');
        setImagePreview(result.assets[0].uri);
        setUploading(true);
        setUploadProgress(0);

        const imageData = await uploadImage(result.assets[0].uri, setUploadProgress);
        setUploadProgress(100);

        setFormData(prev => ({
          ...prev,
          image: imageData
        }));
      }
    } catch (err) {
      console.error('Error picking image:', err);
      const message = err.response?.data?.error || err.message || 'Failed to pick image. Please try again.';
      setError(message);
      Alert.alert('Error', message);
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  // Search locations with debouncing
  const searchLocations = async (query) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query || query.trim().length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const encodedQuery = encodeURIComponent(query.trim());
        const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=0`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'WalletApp/1.0',
          },
        });
        
        if (!response.ok) {
          console.warn(`API returned status ${response.status}`);
          setLocationSuggestions([]);
          return;
        }
        
        const text = await response.text();
        
        if (!text || text.trim().length === 0) {
          console.warn('Empty response from API');
          setLocationSuggestions([]);
          return;
        }
        
        if (text.startsWith('<')) {
          console.warn('Received HTML instead of JSON');
          setLocationSuggestions([]);
          return;
        }
        
        try {
          const data = JSON.parse(text);
          
          if (Array.isArray(data) && data.length > 0) {
            const suggestions = data.map((item) => ({
              name: item.display_name || item.name,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
            }));
            setLocationSuggestions(suggestions);
            setShowSuggestions(true);
          } else {
            setLocationSuggestions([]);
            setShowSuggestions(false);
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          setLocationSuggestions([]);
        }
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "WalletApp/1.0",
          },
        }
      );

      const text = await res.text();

      if (!text || text.trim().startsWith("<")) {
        console.warn("Nominatim returned HTML instead of JSON");
        return "";
      }

      const data = JSON.parse(text);

      if (!data?.display_name) return "";

      return data.display_name
        .split(",")
        .slice(0, 3)
        .map(p => p.trim())
        .join(", ");
    } catch (err) {
      console.error("Reverse geocode failed:", err);
      return "";
    }
  };

  // Select location from suggestions
  const selectLocation = (location) => {
    handleInputChange('location', location.name);
    setCoords({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  // Handle input changes
  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate form based on type
  const validateForm = useCallback((type = initialType) => {
    if (!formData.name.trim()) {
      setError('Item name is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    if (!formData.location.trim()) {
      setError('Location is required');
      return false;
    }
    if (!formData.category) {
      setError('Category is required');
      return false;
    }
    if (!formData.color) {
      setError('Color is required');
      return false;
    }
    // Image is required only for FOUND items
    if (type === 'FOUND' && (!formData.image || !formData.image.url)) {
      setError('Image is required for found items');
      return false;
    }
    setError('');
    return true;
  }, [formData, initialType]);

  // Request location permission for map interactions
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please grant location access to use the map. You can enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  return {
    // State
    formData,
    imagePreview,
    coords,
    locationError,
    locationSuggestions,
    showSuggestions,
    uploading,
    uploadProgress,
    error,
    
    // Setters
    setFormData,
    setImagePreview,
    setCoords,
    setLocationError,
    setLocationSuggestions,
    setShowSuggestions,
    setError,
    
    // Functions
    pickImage,
    searchLocations,
    reverseGeocode,
    selectLocation,
    handleInputChange,
    validateForm,
    requestLocationPermission,
  };
};
