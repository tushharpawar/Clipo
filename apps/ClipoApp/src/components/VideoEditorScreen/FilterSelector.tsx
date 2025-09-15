// src/components/VideoEditorScreen/FilterSelector.js
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useEditorStore } from '../../store/store';
import colors from '../../constants/colors';


  const FILTERS = [
    { name: 'None', value: 'none', emoji: '🚫' },
    { name: 'Vintage', value: 'vintage', emoji: '📸' },
    { name: 'Black & White', value: 'blackwhite', emoji: '⚫' },
    { name: 'Sepia', value: 'sepia', emoji: '🟤' },
    { name: 'Bright', value: 'bright', emoji: '☀️' },
    { name: 'Dark', value: 'dark', emoji: '🌙' },
    { name: 'Cool', value: 'cool', emoji: '❄️' },
    { name: 'Warm', value: 'warm', emoji: '🔥' },
    { name: 'Blur', value: 'blur', emoji: '💫' },
    { name: 'Sharpen', value: 'sharpen', emoji: '🔷' },
  ];

const FilterSelector = () => {
  const { activeFilter, setActiveFilter } = useEditorStore() as any;

  return (
    <View style={styles.container}>
      <FlatList
        data={FILTERS}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.value}
        renderItem={({ item: filter }) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterOption,
              activeFilter === filter.value && styles.filterOptionSelected
                  ]}
                  onPress={() => setActiveFilter(filter.value)}
                >
                  <Text style={styles.filterEmoji}>{filter.emoji}</Text>
                  <Text style={[
                    styles.filterOptionText,
                    activeFilter === filter.value && styles.filterOptionTextSelected
                  ]}>
                    {filter.name}
                  </Text>
                  {activeFilter === filter.value && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  activeFilterButton: {
    backgroundColor: '#007bff',
  },
  filterText: {
    color: '#000',
  },
//   filterButton: {
//     padding: 8,
//     borderRadius: 18,
//     backgroundColor: '#9C27B0',
//     borderWidth: 1,
//     borderColor: colors.border,
//     minWidth: 36,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
  filterButtonActive: {
    backgroundColor: '#7B1FA2',
    borderColor: '#9C27B0',
  },
  filterButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: colors.background || '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#e0e0e0',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary || '#000',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundSecondary || '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textPrimary || '#000',
  },
  filterScrollView: {
    maxHeight: 400,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary || '#f8f8f8',
  },
  filterOptionSelected: {
    backgroundColor: colors.accentPrimary || '#007AFF',
  },
  filterEmoji: {
    fontSize: 24,
    marginRight: 15,
  },
  filterOptionText: {
    fontSize: 16,
    color: colors.textPrimary || '#000',
    flex: 1,
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  checkMark: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default FilterSelector;