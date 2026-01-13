import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ScrollView, 
  Platform, 
  Alert, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

export const AddItemForm = () => {
  const [itemType, setItemType] = useState('lost'); // 'lost' or 'found'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    date: new Date(),
    showDatePicker: false,
    category: '',
    image: null,
  });
  
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          alert('Sorry, we need camera roll permissions to make this work!');
        }
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        const selectedImage = result.assets[0];
        setImagePreview(selectedImage.uri);
        setFormData({
          ...formData,
          image: selectedImage.uri
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick an image: ' + error.message);
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled) {
        const selectedImage = result.assets[0];
        setImagePreview(selectedImage.uri);
        setFormData({
          ...formData,
          image: selectedImage.uri
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take a photo: ' + error.message);
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Library',
          onPress: pickImage,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData({
      ...formData,
      image: null
    });
  };

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  }

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || formData.date;
    setFormData({
      ...formData,
      showDatePicker: Platform.OS === 'ios' ? true : false,
      date: currentDate,
    });
  };

  const showDatepicker = () => {
    setFormData({
      ...formData,
      showDatePicker: true,
    });
  };

  const handleSubmit = () => {
    // Simple validation
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    
    console.log('Form submitted:', { 
      ...formData, 
      type: itemType,
      date: formData.date.toISOString()
    });
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      location: '',
      date: new Date(),
      showDatePicker: false,
      category: '',
      image: null,
    });
    setImagePreview(null);
    
    Alert.alert('Success', 'Item submitted successfully!');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Report Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity 
            style={[styles.typeButton, itemType === 'lost' && styles.activeTypeButton]}
            onPress={() => setItemType('lost')}
          >
            <Ionicons 
              name="search" 
              size={20} 
              color={itemType === 'lost' ? '#fff' : '#4A90E2'}
            />
            <Text style={[styles.typeText, itemType === 'lost' && styles.activeTypeText]}>
              I Lost an Item
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.typeButton, itemType === 'found' && styles.activeTypeButton]}
            onPress={() => setItemType('found')}
          >
            <Ionicons 
              name="eye" 
              size={20} 
              color={itemType === 'found' ? '#fff' : '#4A90E2'}
            />
            <Text style={[styles.typeText, itemType === 'found' && styles.activeTypeText]}>
              I Found an Item
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Item Details</Text>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Item Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., iPhone 13, Black Wallet"
            placeholderTextColor="#999"
            value={formData.name}
            onChangeText={(text) => handleInputChange('name', text)}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide a detailed description..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) => handleInputChange('description', text)}
          />
        </View>
      </View>


      <View style={styles.card}>
        <Text style={styles.sectionTitle}>When & Where</Text>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Date & Time</Text>
          <TouchableOpacity 
            style={styles.dateInput}
            onPress={showDatepicker}
          >
            <Ionicons name="calendar" size={20} color="4A90E2" style={styles.inputIcon} />
            <Text style={styles.dateText}>
              {formData.date.toLocaleString()}
            </Text>
          </TouchableOpacity>
          {formData.showDatePicker && (
            <DateTimePicker
              value={formData.date}
              mode="datetime"
              display="default"
              onChange={handleDateChange}
            />
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.locationInputContainer}>
            <Ionicons name="location" size={20} color="#4A90E2" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Where did you lose/find it?"
              placeholderTextColor="#999"
              value={formData.location}
              onChangeText={(text) => handleInputChange('location', text)}
            />
          </View>
        </View>
      </View>


      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.formGroup}>
          <View style={styles.categoryContainer}>
            {['Electronics', 'Documents', 'Clothing', 'Accessories', 'Other'].map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  formData.category === category && styles.selectedCategoryButton,
                ]}
                onPress={() => handleInputChange('category', category)}
              >
                <Text 
                  style={[
                    styles.categoryText,
                    formData.category === category && styles.selectedCategoryText,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Photo</Text>
        <View style={styles.formGroup}>
          {imagePreview ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imagePreview }} style={styles.imagePreview} />
              <View style={styles.imageActions}>
                <TouchableOpacity 
                  style={[styles.imageActionButton, { backgroundColor: '#4A90E2' }]} 
                  onPress={showImagePickerOptions}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.imageActionText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.imageActionButton, { backgroundColor: '#ff4444' }]} 
                  onPress={removeImage}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.imageActionText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.uploadButton} 
              onPress={showImagePickerOptions}
            >
              <Ionicons name="camera" size={24} color="#4A90E2" />
              <Text style={styles.uploadButtonText}>Upload Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>
          {itemType === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeTypeText: {
    color: '#fff',
  },
  typeIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    margin: 2,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  typeText: {
    marginLeft: 8,
    fontWeight: '500',
    color: '#4A90E2',
  },
  activeTypeButton: {
    backgroundColor: '#4A90E2',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e5eb',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e1e5eb',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginRight: 8,
  },
  inputWithIcon: {
    flex: 1,
    marginLeft: 0,
    paddingLeft: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F5F7FA',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E1E5EB',
    minWidth: 100,
    alignItems: 'center',
  },
  selectedCategoryButton: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  categoryText: {
    color: '#666',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E1E5EB',
    borderStyle: 'dashed',
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    contentFit: 'contain',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 16,
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    justifyContent: 'center',
  },
  imageActionText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  uploadButtonText: {
    marginLeft: 12,
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '500',
  },
});
