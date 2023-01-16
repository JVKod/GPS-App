import React, { useState, useEffect } from 'react';
import { Platform, View, TextInput, Text, Alert, Button, StyleSheet, ImageBackground } from 'react-native';
import { db, firestore, auth } from './FirebaseConfig';

// 1 expo api never taught in class
import * as Location from 'expo-location';

// 3 expo apis from class
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import { Audio } from 'expo-av';


export default function App() {
  // state variables
  [registrationEmail, setRegistrationEmail] = useState('');
  [registrationPassword, setRegistrationPassword] = useState('');
  [loginEmail, setLoginEmail] = useState('');
  [loginPassword, setLoginPassword] = useState('');
  [loggedIn, setLoggedIn] = useState(false);
  [databaseData, setDatabaseData] = useState('');

  // state variables for location usage
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // variable for expo-av usage
  let soundObject = null;

  playAudio = async () => {
      await Audio.setAudioModeAsync({
          // set to false to play through speaker (instead of headset)
          allowsRecordingIOS: false,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
      });

      soundObject = new Audio.Sound();
          try {
              await soundObject.loadAsync(require('./assets/voice_instructions.mp3'));
              await soundObject.setStatusAsync({ isLooping: false });
              await soundObject.playAsync();
              console.log('we are playing the instructions!')
          } catch (error) {
              console.log('An error occurred on playback:');
              console.log(error);
          }
  };

  // get and return current date
  const getCurrentDate = () => {

      var date = new Date().getDate();
      var month = new Date().getMonth() + 1;
      var year = new Date().getFullYear();

      //Alert.alert(date + '-' + month + '-' + year);
      // You can turn it in to your desired format

      return month + '-' + date + '-' + year;
  }
  

  // invoke GPS grab
  useEffect(() => {
    (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);

    })();
  }, []);

  // declare variables in global scope and pass coordinates to variables 
  let text = 'Waiting..';
  let text2 = 'Waiting..';

  if (errorMsg) {
      text = errorMsg;
      text2 = errorMsg;

    } else if (location) {
      text = JSON.stringify(location.coords.longitude);
      text2 = JSON.stringify(location.coords.latitude);
  }

  // send gps coordinates email button handler
  async function sendEmailHandler() {     
      const isAvailable = await MailComposer.isAvailableAsync();

      if (isAvailable) {
      
          var options = {
              subject: 'My GPS Coordinates',
              body: 'Date Sent: ' + getCurrentDate() + '\n\nMy Message: ' + databaseData + '\n\nHere are my GPS Coordinates:\n\n ' + 'Longitude: ' + text + ' \nLatitude: ' + text2
          };
            
          MailComposer.composeAsync(options)
            
          .then( (result) => { console.log(result.status); } );
          } 
    
      else {
          console.log('Email is not available');
      }
  }

  // send gps coordinates sms button handler
  async function sendSMSHandler() {
      const isAvailable = await SMS.isAvailableAsync();

    if (isAvailable) {
        const { result } = await SMS.sendSMSAsync(
            [],
            'Date Sent: ' + getCurrentDate() + '\n\nMy Message: ' + databaseData + '\n\nHere are my GPS Coordinates:\n\n ' + 'Longitude: ' + text + ' \nLatitude: ' + text2
        );
    } 
    
    else {
        console.log('SMS is not available');
    }
  }
  
  // console.log(location.coords.longitude, location.coords.latitude);

  registerWithFirebase = () => {
      if (registrationEmail.length < 4) {
          Alert.alert('Please enter an email address.');
          return;
      }

    if (registrationPassword.length < 4) {
        Alert.alert('Please enter a password.');
        return;
    }

    auth.createUserWithEmailAndPassword(registrationEmail, registrationPassword)
        .then(function (_firebaseUser) {
        Alert.alert('user registered!');

        setRegistrationEmail('');
        setRegistrationPassword('');
      })
      .catch(function (error) {
          var errorCode = error.code;
          var errorMessage = error.message;

        if (errorCode == 'auth/weak-password') {
            Alert.alert('The password is too weak.');
        }
        else {
            Alert.alert(errorMessage);
        }
        console.log(error);
      }
      );
  }

  loginWithFirebase = () => {
    if (loginEmail.length < 4) {
        Alert.alert('Please enter an email address.');
        return;
    }

    if (loginPassword.length < 4) {
        Alert.alert('Please enter a password.');
        return;
    }

    auth.signInWithEmailAndPassword(loginEmail, loginPassword)
        .then(function (_firebaseUser) {
        Alert.alert('user logged in!');
        setLoggedIn(true);

        // load data
        // retrieveDataFromFirebase();
      })
      .catch(function (error) {
          var errorCode = error.code;
          var errorMessage = error.message;

        if (errorCode === 'auth/wrong-password') {
            Alert.alert('Wrong password.');
        }
        else {
            Alert.alert(errorMessage);
        }
      }
      );
  }

  signoutWithFirebase = () => {
      auth.signOut().then(function () {
      // if logout was successful
      if (!auth.currentUser) {
          Alert.alert('user was logged out!');
          setLoggedIn(false);
      }
    });
  }

  function saveDataWithFirebase() {
    // *********************************************************************
    // When saving data, to create a new collection you can use SET 
    // and when updating you can use UPDATE (refer to docs for more info)
    // -- https://firebase.google.com/docs/firestore/manage-data/add-data
    // *********************************************************************

    var userId = auth.currentUser.uid;


    // SAVE DATA TO REALTIME DB
    db.ref('users/' + userId).set({
        Message: databaseData,
        Coordinates: getCurrentDate() + ': ' + text + text2,
    });

    // SAVE DATA TO FIRESTORE
    firestore.collection('users').doc(userId).set(
      {
          Message: databaseData,
          Coordinates: getCurrentDate() + ': ' + text + ' and ' + text2,
      },
      {
          merge: true // set with merge set to true to make sure we don't blow away existing data we didnt intend to
      }
    )
      .then(function () {
          Alert.alert('GPS Coordinates Saved to Database!');
      })
      .catch(function (error) {
          Alert.alert('Error writing document');
          console.log('Error writing document: ', error);
      });
  }

  function retrieveDataFromFirebase() {
    // *********************************************************************
    // When loading data, you can either fetch the data once like in these examples 
    // -- https://firebase.google.com/docs/firestore/query-data/get-data
    // or you can listen to the collection and whenever it is updated on the server
    // it can be handled automatically by your code
    // -- https://firebase.google.com/docs/firestore/query-data/listen
    // *********************************************************************

    var userId = auth.currentUser.uid;

    /*****************************/
    // LOAD DATA FROM REALTIME DB
    /*****************************/

    // read once from data store
    // db.ref('/users/' + userId).once('value').then(function (snapshot) {
    //   setDatabaseData(snapshot.val().text);
    // });

    /*****************************/
    // LOAD DATA FROM FIRESTORE
    /*****************************/

    // read once from data store
    firestore.collection("users").doc(userId).get()
        .then(function (doc) {
            if (doc.exists) {
            setDatabaseData(doc.data().text);
            console.log("Document data:", doc.data());
        } else {
            // doc.data() will be undefined in this case
            console.log("No such document!");
        }
      })
      .catch(function (error) {
          console.log("Error getting document:", error);
      });

    // For real-time updates:
    // firestore.collection("users").doc(userId).onSnapshot(function (doc) {
    //   setDatabaseData(doc.data().text);
    //   console.log("Document data:", doc.data());
    // });

  }

  return (
    <ImageBackground style={ styles.imgBackground } 
                     resizeMode='cover' 
                     source={require('./assets/gps-world.png')}>

      <View style={styles.form}>
          {!loggedIn &&
              <View>
                  <View>
                      <Text style={styles.appTitle}>GPS LOCATION SENDER</Text>
                      <Text style={styles.label}>Create Account</Text>
                          <TextInput
                              style={styles.textInput}
                              onChangeText={ (value) => setRegistrationEmail(value) }
                              autoCapitalize="none"
                              autoCorrect={false}
                              autoCompleteType="email"
                              keyboardType="email-address"
                              placeholder="email"
                          />
                          <TextInput
                              style={styles.textInput}
                              onChangeText={ (value) => setRegistrationPassword(value) }
                              autoCapitalize="none"
                              autoCorrect={false}
                              autoCompleteType="password"
                              keyboardType="visible-password"
                              placeholder="password"
                          />
                          <Button color="darkgreen" style={styles.button} title="Register" onPress={registerWithFirebase} />
                    </View>
                  <View>
                  <Text style={styles.label}>Sign In</Text>
                  <TextInput
                      style={styles.textInput}
                      onChangeText={ (value) => setLoginEmail(value) }
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoCompleteType="email"
                      keyboardType="email-address"
                      placeholder="email"
                  />
                  <TextInput
                      style={styles.textInput}
                      onChangeText={ (value) => setLoginPassword(value) }
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoCompleteType="password"
                      keyboardType="visible-password"
                      placeholder="password"
                  />
                  <Button color="darkgreen" style={styles.button} title="Login" onPress={loginWithFirebase} />

          </View>
      </View>
          }
          {loggedIn &&
              <View>
          
              <Text style={styles.yourGPS}>YOUR GPS COORDINATES ON: {getCurrentDate()}</Text>
              <Text style={styles.longlat}>LONGITUDE: {text}</Text>
              <Text style={styles.longlat}>LATITUDE: {text2}</Text>
          
              <View style={styles.button}>
                  <Button color="darkgreen" title="play app instructions" onPress={playAudio} />
              </View>
          
              <Text style={styles.label}>ENTER A MESSAGE TO ADD TO YOUR GPS COORDINATES:</Text>

              <TextInput
                  style={styles.textInput}
                  multiline={true}
                  numberOfLines={4}
                  onChangeText={(value) => setDatabaseData(value) }
                  value={databaseData}
              />
              <View>
            
                  <View style={styles.button}>
                      <Button color="darkgreen" title="Email Someone" onPress={sendEmailHandler}/>
                  </View>

                  <View style={styles.button}>
                      <Button color="darkgreen" title="Send SMS to Someone " onPress={sendSMSHandler}/>
                  </View>

                  <View style={styles.button}>
                      <Button uppercase='false' color="darkgreen" title="Save to DataBase" onPress={saveDataWithFirebase} />
                  </View>

                  <View style={styles.button}>
                      <Button color="darkblue" style={styles.button} title="Sign Out" onPress={signoutWithFirebase} />
                  </View>
              </View>
          
        </View>
      }
    </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  form: {
      margin: 30,
      marginTop: 60 
  },
  appTitle: {
      fontSize: 45,
      color: 'white',
      marginBottom: 150,
      marginTop: 35,
      textAlign: 'center'
  },
  label: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 15,
      marginTop: 25,
      textAlign: 'center',
      color: 'white'
  },
  yourGPS: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 25,
    textAlign: 'center',
    color: 'white'
},
  longlat: {
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 25,
    textAlign: 'center',
    color: 'red'
},
  textInput: {
      borderColor: '#ccc',
      borderWidth: 1,
      borderRadius: 5,
      marginBottom: 15,
      paddingVertical: 4,
      paddingHorizontal: 2,
      textAlignVertical: 'top',
      color: 'white'
  },
  button: {
      width: '100%',
      marginBottom: 10,
  },
  imgBackground: {
    width: '100%',
    height: '100%',
    flex: 1 
},

});
