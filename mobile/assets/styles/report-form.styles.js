import { StyleSheet } from 'react-native';

/**
 * Shared styles for report-found and report-lost forms
 * @param {string} type - 'FOUND' or 'LOST'
 * @returns {object} StyleSheet object with type-specific colors
 */
export const getReportFormStyles = (type = 'FOUND') => {
  const primaryColor = type === 'FOUND' ? '#2E7D32' : '#1976D2';
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      textAlign: 'center',
      color: primaryColor,
    },
    scrollView: {
      flex: 1,
      padding: 16,
    },
    imageSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    imageUpload: {
      width: 200,
      height: 200,
      borderRadius: 8,
      backgroundColor: '#f8f9fa',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#e9ecef',
      borderStyle: 'dashed',
    },
    imagePreview: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    imagePlaceholder: {
      alignItems: 'center',
    },
    imagePlaceholderText: {
      marginTop: 8,
      color: '#666',
    },
    formGroup: {
      marginBottom: 10,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 8,
      color: '#333',
    },
    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: '#f8f9fa',
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    categoryContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    categoryButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: '#f1f3f5',
      marginRight: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    categoryButtonActive: {
      backgroundColor: primaryColor,
      borderColor: primaryColor,
    },
    categoryButtonText: {
      fontSize: 14,
      color: '#495057',
    },
    categoryButtonTextActive: {
      color: '#fff',
    },
    datePickerButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      backgroundColor: '#f8f9fa',
    },
    dateText: {
      fontSize: 16,
      color: '#333',
    },
    submitButton: {
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 20,
      backgroundColor: primaryColor,
      opacity: 1,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.6,
    },
    errorText: {
      color: '#d32f2f',
      fontSize: 14,
      flex: 1,
    },
    mapContainer: {
      marginTop: 28,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      overflow: 'hidden',
      height: 300,
    },
    map: {
      flex: 1,
    },
    errorBox: {
      marginTop: 12,
      padding: 12,
      backgroundColor: '#ffebee',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#ef5350',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    locationInputContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    suggestionsContainer: {
      position: 'absolute',
      top: 50,
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      maxHeight: 200,
      zIndex: 1000,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    suggestionText: {
      marginLeft: 12,
      fontSize: 14,
      color: '#333',
      flex: 1,
    },
    clearLocationButton: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: [{ translateY: -9 }],
    },
  });
};
