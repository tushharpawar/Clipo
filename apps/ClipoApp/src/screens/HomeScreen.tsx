import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import colors from '../constants/colors'
import UploadVideoButton from '../components/HomeScreen/UploadVideoButton'
import { s } from 'react-native-size-matters'

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clipo</Text>
      <View
        style={styles.uploadButtonContainer}
      >
        <UploadVideoButton/>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    justifyContent: 'center',
    marginTop: s(60),
  },
  uploadButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: s(100),
  },
})

export default HomeScreen