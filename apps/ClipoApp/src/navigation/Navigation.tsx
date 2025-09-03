import React from "react";
import {createNavigationContainerRef, NavigationContainer} from "@react-navigation/native";
import MainNavigation from "./MainNavigation";

const navigationRef = createNavigationContainerRef()

const Navigation:React.FC = () =>{
    return(
        <NavigationContainer ref={navigationRef}>
            <MainNavigation/>
        </NavigationContainer>
    )
}

export default Navigation;