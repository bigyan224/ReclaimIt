import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { getAuthenticatedApi } from '../../../services/api';
import { useItemReportForm } from '../../../hooks/useItemReportForm';
import { getReportFormStyles } from '../../../assets/styles/report-form.styles';
import { useI18n } from '../../../i18n/I18nProvider';
import LeafletMap from '../../../components/LeafletMap';

export default function EditItem() {
  const params = useLocalSearchParams();
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { getToken } = useAuth();
  const { t } = useI18n();

  const [item, setItem] = useState(null);
  const [loadingItem, setLoadingItem] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const styles = getReportFormStyles(item?.type || 'LOST');

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const categories = useMemo(() => ([
    { key: 'electronics', value: 'Electronics' },
    { key: 'documents', value: 'Documents' },
    { key: 'clothing', value: 'Clothing' },
    { key: 'accessories', value: 'Accessories' },
    { key: 'other', value: 'Other' },
  ]), []);

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
  } = useItemReportForm(item?.type || 'LOST', item, true);

  useEffect(() => {
    const loadItem = async () => {
      if (!itemId) {
        return;
      }

      try {
        setLoadingItem(true);
        setLoadError('');
        const token = await getTokenRef.current({ skipCache: true });
        const api = getAuthenticatedApi(token, getTokenRef.current);
        const response = await api.getItemById(itemId);
        setItem(response?.item || null);
      } catch (err) {
        console.error('Error loading item for edit:', err);
        const message = err.response?.data?.message || t('report.reportFailed');
        setLoadError(message);
      } finally {
        setLoadingItem(false);
      }
    };

    loadItem();
  }, [itemId, t]);

  const initialLocationName = item?.location?.name || '';
  const initialDateIso = item?.dateTime ? new Date(item.dateTime).toISOString() : '';
  const currentDateIso = formData.date ? new Date(formData.date).toISOString() : '';
  const initialImageUrl = item?.image?.url || '';
  const currentImageUrl = formData.image?.url || imagePreview || '';
  const initialCoords = item?.location?.coordinates?.coordinates || [];
  const hasCoordChange = !Array.isArray(initialCoords)
    || initialCoords.length !== 2
    || initialCoords[0] !== coords.longitude
    || initialCoords[1] !== coords.latitude;

  const hasChanges = !!item && (
    formData.name.trim() !== (item.itemName || '') ||
    formData.description.trim() !== (item.description || '') ||
    formData.location.trim() !== initialLocationName ||
    formData.category !== (item.category || '') ||
    formData.brandName.trim() !== (item.brandName || '') ||
    formData.color.trim() !== (item.color || '') ||
    currentDateIso !== initialDateIso ||
    currentImageUrl !== initialImageUrl ||
    hasCoordChange
  );

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

    if (!item) return;

    if (!validateForm(item.type)) return;

    if (!hasChanges) {
      Alert.alert(t('common.ok'), 'No changes were made.');
      return;
    }

    const submissionData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      location: formData.location.trim(),
      date: formData.date.toISOString(),
      category: formData.category,
      brandName: formData.brandName,
      color: formData.color,
      image: formData.image,
      type: item.type,
      coords,
    };

    try {
      setIsSubmitting(true);
      setError('');
      const token = await getToken({ skipCache: true });
      const api = getAuthenticatedApi(token, getToken);
      await api.updateItem(item._id, submissionData);

      Alert.alert(t('common.success'), 'Item updated and rematched successfully.', [
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (updateError) {
      console.error('Error updating item:', updateError);
      const message = updateError.response?.data?.message || t('report.reportFailed');
      setError(message);
      Alert.alert(t('common.error'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingItem) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: '#64748B' }}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (loadError || !item) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
        <Text style={{ marginTop: 12, color: '#0F172A', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
          {loadError || 'Item not found'}
        </Text>
        <TouchableOpacity
          style={[styles.submitButton, { marginTop: 20, width: '100%' }]}
          onPress={() => router.back()}
        >
          <Text style={styles.submitButtonText}>{t('common.close')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {item.type === 'FOUND' ? t('report.reportFoundTitle') : t('report.reportLostTitle')}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled={true}
        >
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
                    backgroundColor: '#E5E7EB',
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      backgroundColor: '#3B82F6',
                    }}
                  />
                </View>
              </View>
            )}
          </View>

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
                    formData.category === category.value && styles.categoryButtonActive,
                  ]}
                  onPress={() => handleInputChange('category', category.value)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      formData.category === category.value && styles.categoryButtonTextActive,
                    ]}
                  >
                    {t(`report.categories.${category.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
            <Text style={styles.label}>{item.type === 'FOUND' ? t('report.whereFound') : t('report.whereLost')}</Text>
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
            <Text style={styles.label}>{item.type === 'FOUND' ? t('report.whenFound') : t('report.whereLost')}</Text>
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
            style={[
              styles.submitButton,
              (isSubmitting || uploading || !hasChanges) && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || uploading || !hasChanges}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? t('common.submitting') : 'Update Item'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
