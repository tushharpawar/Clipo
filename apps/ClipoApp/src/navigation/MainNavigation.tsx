import React, { FC } from 'react'
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import VideoEditorScreen from '../screens/VideoEditorScreen';

const Stack = createNativeStackNavigator();

const MainNavigation:FC = () => {
  return (
    <Stack.Navigator
    initialRouteName="HomeScreen"
    screenOptions={() => ({
      headerShown: false,
    })}
    >
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen name="VideoEditorScreen" component={VideoEditorScreen} />
    </Stack.Navigator>
  )
}

export default MainNavigation