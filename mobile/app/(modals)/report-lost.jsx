import { useState } from 'react';
import { useRouter } from 'expo-router';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Platform, 
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
let MapView, Marker, UrlTile;
try {
  // Lazy require to avoid native module crash in builds without react-native-maps configured
  const maps = require('react-native-maps');
  MapView = maps.default || maps.MapView || maps;
  Marker = maps.Marker;
  UrlTile = maps.UrlTile;
} catch (err) {
  console.warn('react-native-maps not available:', err?.message || err);
}
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '@clerk/clerk-expo';
import { getAuthenticatedApi } from '../../services/api';
import { useItemReportForm } from '../../hooks/useItemReportForm';
import { getReportFormStyles } from '../../assets/styles/report-form.styles';

export default function ReportLost() {
  const styles = getReportFormStyles('LOST');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { getToken } = useAuth();

  // Use the shared hook
  const {
    formData,
    imagePreview,
    coords,
    locationError,
    locationSuggestions,
    showSuggestions,
    uploading,
    uploadProgress,
    error,
    setCoords,
    setShowSuggestions,
    setLocationSuggestions,
    setError,
    pickImage,
    searchLocations,
    reverseGeocode,
    selectLocation,
    handleInputChange,
    validateForm,
    requestLocationPermission,
  } = useItemReportForm('LOST');

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || formData.date;
    handleInputChange('showDatePicker', Platform.OS === 'ios' ? true : false);
    handleInputChange('date', currentDate);
  };

  const showDatepicker = () => {
    handleInputChange('showDatePicker', true);
  };

  const handleSubmit = async () => {
    if (!validateForm('LOST')) return;
    
    setIsSubmitting(true);
     const token = await getToken();
      const api = getAuthenticatedApi(token);

    
    try {
      const itemData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        date: formData.date.toISOString(),
        category: formData.category,
        brandName: formData.brandName,
        color: formData.color,
        image: formData.image, // { url, publicId } or null
        type: 'LOST',
        coords: coords,
      };

      const result = await api.reportItem(itemData);
      console.log(result);
      
      Alert.alert(
        'Success',
        'Your lost item has been reported successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)/')
          }
        ]
      );
    } catch (error) {
      console.error('Error reporting item:', error);
      const errorMessage = error.response?.data?.message || 'Failed to report item. Please try again.';
      setError(errorMessage);
      setIsSubmitting(false);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

 


  return (
    <KeyboardAwareScrollView
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraScrollHeight={100}
      extraHeight={100}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report Lost Item</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled={true}
      >
        {/* Image Upload */}
        <View style={styles.imageSection}>
            <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
              {imagePreview ? (
                <Image 
                  source={{ uri: imagePreview }} 
                  style={styles.imagePreview}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color="#666" />
                  <Text style={styles.imagePlaceholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {uploading && (
  <View style={{ marginTop: 10 }}>
    <Text>Uploading {uploadProgress}%</Text>

    <View
      style={{
        height: 6,
        backgroundColor: "#E5E7EB",
        borderRadius: 4,
        overflow: "hidden",
        marginTop: 4,
      }}
    >
      <View
        style={{
          width: `${uploadProgress}%`,
          height: "100%",
          backgroundColor: "#3B82F6",
        }}
      />
    </View>
  </View>
)}

          </View>

          {/* Form Fields */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter item name"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Brand Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter brand name (if known)"
              value={formData.brandName}
              onChangeText={(text) => handleInputChange('brandName', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Color *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter item color"
              value={formData.color}
              onChangeText={(text) => handleInputChange('color', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Provide detailed description of the item..."
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryContainer}>
              {['Electronics', 'Documents', 'Clothing', 'Accessories', 'Other'].map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    formData.category === category && styles.categoryButtonActive
                  ]}
                  onPress={() => handleInputChange('category', category)}
                >
                  <Text 
                    style={[
                      styles.categoryButtonText,
                      formData.category === category && styles.categoryButtonTextActive
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

         <View style={styles.mapContainer}>
    {MapView ? (
      <MapView
        style={styles.map}
        region={{
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      onPress={async(e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        setCoords({ latitude, longitude });
        handleInputChange('location', '');
        const placeName = await reverseGeocode(latitude, longitude);
        console.log(placeName)
          if (placeName) {
    handleInputChange('location', placeName);
  }
      }}
    >
      {/* OpenStreetMap tiles */}
      {UrlTile && (
      <UrlTile
        urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        minimumZ={0}
        attribution=" OpenStreetMap contributors"
      />
      )}

      <Marker
        coordinate={coords}
        draggable
        onDragEnd={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          setCoords({ latitude, longitude });
          handleInputChange('location', `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }}
      />
    </MapView>
    ) : (
      <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }]}>
        <Ionicons name="map-outline" size={48} color="#ccc" />
        <Text style={{ color: '#666', marginTop: 8 }}>Map not available</Text>
      </View>
    )}
  </View>

  {locationError && (
    <View style={styles.errorBox}>
      <Ionicons name="information-circle" size={20} color="#FF6B6B" />
      <Text style={styles.errorText}>{locationError}</Text>
    </View>
  )}



          <View style={styles.formGroup}>
            <Text style={styles.label}>Location *</Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter location (e.g., Delhi, Paris...)"
                value={formData.location}
                onChangeText={(text) => {
                  handleInputChange('location', text);
                  searchLocations(text);
                }}
                onFocus={() => {
                  if (locationSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholderTextColor="#999"
              />
              {formData.location.length > 0 && (
                <TouchableOpacity
                  style={styles.clearLocationButton}
                  onPress={() => {
                    handleInputChange('location', '');
                    setLocationSuggestions([]);
                    setShowSuggestions(false);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
              
              {showSuggestions && locationSuggestions.length > 0 && (
                <ScrollView style={styles.suggestionsContainer} nestedScrollEnabled>
                  {locationSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => selectLocation(suggestion)}
                    >
                      <Ionicons name="location" size={16} color="#666" />
                      <Text style={styles.suggestionText} numberOfLines={1}>
                        {suggestion.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>


          <View style={styles.formGroup}>
            <Text style={styles.label}>When did you lose it? *</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={showDatepicker}
            >
              <Text style={styles.dateText}>
                {formData.date.toLocaleDateString()}
              </Text>
              <Ionicons name="calendar" size={20} color="#666" />
            </TouchableOpacity>
            
            {formData.showDatePicker && (
              <DateTimePicker
                value={formData.date}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}
          </View>

          {error ? (
            <View style={[styles.errorBox, { marginTop: 16 }]}>
              <Ionicons name="alert-circle" size={20} color="#d32f2f" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
      <TouchableOpacity 
        style={[styles.submitButton, (isSubmitting || uploading) && styles.disabledButton]} 
        onPress={handleSubmit}
        disabled={isSubmitting || uploading}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Submitting...' : 'Report Lost Item'}
        </Text>
      </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAwareScrollView>
  );
}
