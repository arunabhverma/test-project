import React, {
  useState,
  useEffect,
} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import BleManager from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const getLocationPermission = () => {
  if (Platform.OS === 'android' && Platform.Version >= 23) {
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then((result) => {
      if (result) {
        console.log("Permission is OK");
      } else {
        PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then((result) => {
          if (result) {
            console.log("User accept");
          } else {
            console.log("User refuse");
          }
        });
      }
    });
  }
}

const App = () => {
  const [state, setState] = useState({
    isBluetoothOn: null,
    list: [],
    isScanning: false,
    loadingId: ''
  });

  const peripherals = new Map();

  useEffect(() => {
    if (state.isBluetoothOn === null) {
      bluetoothOn();
    }
  }, [state.isBluetoothOn])

  useEffect(() => {
    BleManager.start({ showAlert: false });
    let first = bleManagerEmitter.addListener('BleManagerDidUpdateState', deviceBluetoothState)
    let second = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral);
    let third = bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan);
    let fourth = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', handleDisconnectedPeripheral);
    getLocationPermission();

    return (() => {
      first.remove();
      second.remove();
      third.remove();
      fourth.remove();
    })
  }, []);

  const bluetoothOn = () => {
    BleManager.enableBluetooth()
      .then(() => {
        setState(prev => ({ ...prev, isBluetoothOn: true }));
      })
      .catch((error) => {
        setState(prev => ({ ...prev, isBluetoothOn: false }));
      });
  }

  const startScan = () => {
    if (!state.isScanning) {
      BleManager.scan([], 3, true).then(() => {
        setState(prev => ({ ...prev, isScanning: true }));
      }).catch(err => {
        console.error(err);
      });
    }
  }

  const handleStopScan = () => {
    setState(prev => ({ ...prev, isScanning: false }));
  }

  const handleDisconnectedPeripheral = (data) => {
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      setState(prev => ({ ...prev, list: Array.from(peripherals.values()) }))
    }
  }

  const retrieveConnected = () => {
    BleManager.getConnectedPeripherals([]).then((results) => {
      if (results.length == 0) {
        setState(prev => ({ ...prev, list: [] }))
      }
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        setState(prev => ({ ...prev, list: Array.from(peripherals.values()) }))
      }
    });
  }

  const deviceBluetoothState = props => {
    setState(prev => ({ ...prev, isBluetoothOn: props.state === "on" ? true : false }))
  }

  const handleDiscoverPeripheral = (peripheral) => {
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    peripherals.set(peripheral.id, peripheral);
    setState(prev => ({ ...prev, list: Array.from(peripherals.values()) }))
  }

  const testPeripheral = (peripheral) => {
    setState(prev => ({...prev, loadingId: peripheral.id}))
    if (peripheral) {
      if (peripheral.connected) {
        BleManager.disconnect(peripheral.id).then(() => {
          const data = state.list?.map(item => {
            if(item.id === peripheral.id){
              return {...item, connected: true}
            } else {
              return item
            }
          })
          // p.connected = true;
          // peripherals.set(peripheral.id, p);
          setState(prev => ({ ...prev, list: data, loadingId: '' }))
          alert(`disconnected with ${peripheral.id}`)
        });
      } else {
        BleManager.connect(peripheral.id).then(() => {
          let p = peripherals.get(peripheral.id);
          if (p) {
            const data = state.list?.map(item => {
              if(item.id === peripheral.id){
                return {...item, connected: true}
              } else {
                return item
              }
            })
            // p.connected = true;
            // peripherals.set(peripheral.id, p);
            setState(prev => ({ ...prev, list: data, loadingId: '' }))
          }
          alert(`connected with ${peripheral.id}`);
          setTimeout(() => {
            BleManager.retrieveServices(peripheral.id).then((peripheralData) => {
              BleManager.readRSSI(peripheral.id).then((rssi) => {
                let p = peripherals.get(peripheral.id);
                if (p) {
                  p.rssi = rssi;
                  peripherals.set(peripheral.id, p);
                  setState(prev => ({ ...prev, list: Array.from(peripherals.values()) }))
                }
              });
            });
          }, 1000);
        }).catch((error) => {
          console.log('Connection error', error);
          setState(prev => ({ ...prev, loadingId: '' }))
        });
      }
    }

  }

  const renderItem = ({ item }) => {
    const color = item.connected ? 'rgba(100, 255, 100, 0.4)' : 'white';
    return (
      <Pressable disabled={state.loadingId === item.id} android_ripple={{color: 'rgba(0, 0, 0, 0.1)'}} onPress={() => testPeripheral(item)} style={[styles.row, { backgroundColor: color }]}>
        <View>
          <Text style={[styles.newFont, {paddingVertical: 10}]}>{`${item.name} (id : ${item.id})`}</Text>
          <Text style={[styles.newFont, {fontSize: 13}]}>{!!item.connected ? 'CONNECTED' : 'NOT CONNECTED'}</Text>
          <Text style={[styles.newFont, {fontSize: 13}]}>RSSI: {item.rssi}</Text>
          <Text style={[styles.newFont, {fontSize: 13, paddingBottom: 15}]}>CONNECTABLE: {item.advertising.isConnectable.toString()}</Text>
          </View>
          <View>
            {state.loadingId === item.id && <ActivityIndicator color={'teal'} size={'large'} />}
          </View>
      </Pressable>
    );
  }

  const Button = ({ title, onPress, isLoading }) => {
    return (
      <View style={styles.buttonWrapper}>
        <Pressable disabled={isLoading} onPress={onPress} android_ripple={{ color: 'rgba(0, 0, 0, 0.1)' }} style={[styles.buttonStyle, styles.center]}>
          {isLoading ? <ActivityIndicator color={'white'} /> : <Text style={styles.buttonText}>{title}</Text>}
        </Pressable>
      </View>
    );
  }

  const ListEmptyComponent = () => {
    return (
      <View style={[styles.flexOne, styles.center]}>
        {state.isBluetoothOn ? <Text style={{color: 'black'}}>No peripherals</Text>
          : <Text style={{color: 'black'}}>Please turn on the bluetooth</Text>}
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={'light-content'} backgroundColor={'teal'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <FlatList
          data={state.isBluetoothOn ? state.list : []}
          contentContainerStyle={styles.contentContainerStyle}
          ListEmptyComponent={ListEmptyComponent}
          renderItem={renderItem}
          keyExtractor={item => item.id}
        />
        <View style={styles.buttonFloat}>
          {state.isBluetoothOn ? <>
            <Button
              title={'Scan Bluetooth'}
              onPress={() => startScan()}
            />
            <Button title="Retrieve connected peripherals" onPress={() => retrieveConnected()} />
          </> :
            <Button isLoading={state.isScanning} title="Turn Bluetooth On" onPress={bluetoothOn} />}
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  contentContainerStyle: {
    flexGrow: 1,
    paddingBottom: 200
  },
  buttonFloat: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
  },
  buttonStyle: {
    backgroundColor: 'teal',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 50,
  },
  buttonWrapper: {
    overflow: 'hidden',
    borderRadius: 50,
    margin: 10
  },
  newFont: {
    fontSize: 15,
    color: 'black',
    fontWeight: '500',
    padding: 2
  },
  buttonText: {
    color: 'white',
    fontSize: 15
  },
  row: {
    paddingHorizontal: 20,
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center'
  }
});

export default App;
