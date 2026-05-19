# SG Bus Timings

Mobile app for Singapore bus arrivals using LTA DataMall real-time Bus Arrival v3 and OpenStreetMap tiles.

## Setup

1. Request an LTA DataMall AccountKey from <https://datamall.lta.gov.sg/>.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Start Expo:

   ```sh
   npm start
   ```

4. Open the app in Expo Go or an emulator, paste your AccountKey, then refresh bus stops.

The app stores the AccountKey and bus-stop cache locally on the device. Arrival timings refresh every 20 seconds while a bus stop is selected.
