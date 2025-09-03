import { View, Text, SafeAreaViewBase, StatusBar } from 'react-native'
import React from 'react'
import Navigation from './src/navigation/Navigation'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import colors from './src/constants/colors'

const App = () => {
  return (
      <GestureHandlerRootView style={{flex:1}}>
          <StatusBar 
          translucent={false} 
          backgroundColor={colors.background} 
          barStyle="light-content"
        />
        <Navigation />
      </GestureHandlerRootView>
  )
}

export default App