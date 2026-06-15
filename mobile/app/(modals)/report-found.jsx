import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Platform, 
  Alert,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import DateTimePicker from '@react-native-community/datetimepicker';

import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { getAuthenticatedApi } from '../../services/api';
import { useItemReportForm } from '../../hooks/useItemReportForm';
import { getReportFormStyles } from '../../assets/styles/report-form.styles';
import { useI18n } from '../../i18n/I18nProvider';
import LeafletMap from '../../components/LeafletMap';

export default function ReportFound() {
  const styles = getReportFormStyles('FOUND');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const categories = [
    { key: 'electronics', value: 'Electronics' },
    { key: 'documents', value: 'Documents' },
    { key: 'clothing', value: 'Clothing' },
    { key: 'accessories', value: 'Accessories' },
    { key: 'other', value: 'Other' },
  ];

  const [showInstPicker, setShowInstPicker] = useState(false);

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
    institutions,
    selectedInstitution,
    setCoords,
    setShowSuggestions,
    reverseGeocode,
    setError,
    setSelectedInstitution,
    pickImage,
    searchLocations,
    selectLocation,
    handleInputChange,
    validateForm,
    requestLocationPermission,
  } = useItemReportForm('FOUND');

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || formData.date;
    handleInputChange('showDatePicker', Platform.OS === 'ios' ? true : false);
    handleInputChange('date', currentDate);
  };

  const showDatepicker = () => {
    handleInputChange('showDatePicker', true);
  };

  const handleSubmit = async () => {
    if (uploading) {
      Alert.alert(t('report.pleaseWait'), t('report.uploadInProgress'));
      return;
    }

    if (!validateForm('FOUND')) return;

    const submissionData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      location: formData.location.trim(),
      date: formData.date.toISOString(),
      category: formData.category,
      brandName: formData.brandName,
      color: formData.color,
      image: formData.image,
      type: 'FOUND',
      coords,
      institution: selectedInstitution || undefined,
    };

    try {
      setIsSubmitting(true);
      setError('');
      const token = await getToken({ skipCache: true });
      const api = getAuthenticatedApi(token, getToken);
      await api.reportItem(submissionData);

      Alert.alert(t('common.success'), t('report.reportFoundThanks'), [
        { text: t('common.ok'), onPress: () => router.push('/(tabs)/') },
      ]);
    } catch (error) {
      console.error('Error reporting item:', error);
      const message = error.response?.data?.message || t('report.reportFailed');
      setError(message);
      Alert.alert(t('common.error'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('report.reportFoundTitle')}</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        keyboardShouldPersistTaps="always"
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
                          <Text style={styles.imagePlaceholderText}>{t('report.addPhoto')}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {uploading && (
          <View style={{ marginTop: 10 }}>
            <Text>{t('report.uploading', { progress: uploadProgress })}</Text>
        
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
            <Text style={styles.label}>{t('report.itemName')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('report.itemNamePlaceholder')}
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('report.brandNameOptional')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('report.brandPlaceholder')}
              value={formData.brandName}
              onChangeText={(text) => handleInputChange('brandName', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('report.color')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('report.colorPlaceholder')}
              value={formData.color}
              onChangeText={(text) => handleInputChange('color', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('report.description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('report.descriptionPlaceholder')}
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('report.category')}</Text>
            <View style={styles.categoryContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryButton,
                    formData.category === category.value && styles.categoryButtonActive
                  ]}
                  onPress={() => handleInputChange('category', category.value)}
                >
                  <Text 
                    style={[
                      styles.categoryButtonText,
                      formData.category === category.value && styles.categoryButtonTextActive
                    ]}
                  >
                    {t(`report.categories.${category.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          
          {institutions.length > 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('report.institution')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowInstPicker(!showInstPicker)}
              >
                <Text style={[styles.pickerButtonText, !selectedInstitution && { color: '#999' }]}>
                  {selectedInstitution
                    ? institutions.find(i => i._id === selectedInstitution)?.name || t('report.selectInstitution')
                    : t('report.publicListing')}
                </Text>
                <Ionicons name={showInstPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
              </TouchableOpacity>
              {showInstPicker && (
                <View style={styles.pickerDropdown}>
                  <TouchableOpacity
                    style={[styles.pickerOption, !selectedInstitution && styles.pickerOptionActive]}
                    onPress={() => { setSelectedInstitution(''); setShowInstPicker(false); }}
                  >
                    <Text style={[styles.pickerOptionText, !selectedInstitution && styles.pickerOptionTextActive]}>{t('report.publicListing')}</Text>
                  </TouchableOpacity>
                  {institutions.map(inst => (
                    <TouchableOpacity
                      key={inst._id}
                      style={[styles.pickerOption, selectedInstitution === inst._id && styles.pickerOptionActive]}
                      onPress={() => { setSelectedInstitution(inst._id); setShowInstPicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, selectedInstitution === inst._id && styles.pickerOptionTextActive]}>{inst.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

             <View style={styles.mapContainer}>
              <LeafletMap
                style={styles.map}
                region={coords}
                draggable
                onPress={async (e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setCoords({ latitude, longitude });
                  handleInputChange('location', '');
                  const placeName = await reverseGeocode(latitude, longitude);
                  if (placeName) {
                    handleInputChange('location', placeName);
                  }
                }}
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setCoords({ latitude, longitude });
                  handleInputChange('location', `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                }}
              />
            </View>

            {locationError && (
              <View style={styles.errorBox}>
                <Ionicons name="information-circle" size={20} color="#FF6B6B" />
                <Text style={styles.errorText}>{locationError}</Text>
              </View>
            )}
            <View style={styles.formGroup}>
            <Text style={styles.label}>{t('report.whereFound')}</Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('report.locationPlaceholder')}
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
            <Text style={styles.label}>{t('report.whenFound')}</Text>
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

          <TouchableOpacity 
            style={[styles.submitButton, (isSubmitting || uploading) && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isSubmitting || uploading}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? t('common.submitting') : t('report.reportFoundCta')}
            </Text>
          </TouchableOpacity>
          {error ? (
            <View style={[styles.errorBox, { marginTop: 16 }]}>
              <Ionicons name="alert-circle" size={20} color="#d32f2f" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
