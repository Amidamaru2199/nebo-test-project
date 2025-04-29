<template>
	<div class="w-screen h-screen">
		<yandex-map v-model="map" :settings="{
			location: {
				center: [37.617644, 55.755819],
				zoom: 9,
			},
		}">
			<yandex-map-default-scheme-layer />
			<yandex-map-default-features-layer />
			<yandex-map-feature :settings="{
				geometry: {
					type: 'Polygon',
					coordinates: [MKAD_COORDINATES]
				},
				style: {
					stroke: [{
						color: '#006efc',
						width: 4,
					}],
					fill: 'rgba(56, 56, 219, 1)',
				},
			}" />
			<yandex-map-feature :settings="{
				geometry: {
					type: 'Polygon',
					coordinates: [PODMOSKOVIE_COORDINATES]
				},
				style: {
					stroke: [{
						color: '#a99aa2',
						width: 4,
					}],
					fill: 'rgba(169, 154, 162, 0.32)',
				},
			}" />
			<yandex-map-marker v-if="mapStore.sessionClick"
				:settings="{ coordinates: mapStore.sessionClick.coordinates }" position="top-center left-center">
				<div class="w-[75px] h-[75px] rounded-full cursor-pointer bg-cover bg-center"
					style="background-image: url('https://yastatic.net/s3/front-maps-static/maps-front-jsapi-3/examples/images/marker-custom-icon/yellow-capybara.png');">
				</div>
			</yandex-map-marker>

			<yandex-map-feature v-if="airLineFeature" :settings="airLineFeature" />
			<yandex-map-feature v-if="roadLineFeature" :settings="roadLineFeature" />
			<yandex-map-listener :settings="{ onClick: logMapClick }" />
		</yandex-map>
	</div>
</template>

<script setup>
import { shallowRef } from 'vue';
import {
	YandexMap,
	YandexMapDefaultSchemeLayer,
	YandexMapDefaultFeaturesLayer,
	YandexMapFeature,
	YandexMapListener,
	YandexMapMarker,
} from 'vue-yandex-maps';
import { useMapStore } from './stores/useMapStore';
import * as turf from '@turf/turf';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { lineString, point, lineSlice } from '@turf/turf';
import { getDistance } from 'geolib';

const mapStore = useMapStore();
mapStore.loadFromStorage();

const airLineFeature = shallowRef(null);
const roadLineFeature = shallowRef(null);

const map = shallowRef(null);

const logMapClick = async (object, event) => {
	const coordinates = event.coordinates;

	const res = await fetch(`https://geocode-maps.yandex.ru/1.x/?format=json&apikey=3871f9c2-60a7-48f4-9b70-0eed3957290c&geocode=${coordinates[0]},${coordinates[1]}`);
	const data = await res.json();
	const address = data.response.GeoObjectCollection.featureMember[0]?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text;

	// Расчёт прямого расстояния до МКАД
	const minDistanceToMKAD = Math.min(
		...MKAD_COORDINATES.map(coord => getDistance(
			{ latitude: coord[1], longitude: coord[0] },
			{ latitude: coordinates[1], longitude: coordinates[0] }
		))
	);

	// Поиск ближайшей точки МКАД
	const nearestMKADPoint = MKAD_COORDINATES.reduce((nearest, coord) => {
		const dist = getDistance(
			{ latitude: coord[1], longitude: coord[0] },
			{ latitude: coordinates[1], longitude: coordinates[0] }
		);
		return dist < nearest.dist ? { coord, dist } : nearest;
	}, { coord: null, dist: Infinity }).coord;

	// Прямая линия
	const airLine = {
		geometry: {
			type: 'LineString',
			coordinates: [coordinates, nearestMKADPoint],
		},
		style: {
			stroke: [{ color: '#f20282', width: 3, opacity: 1 }]
		}
	};

	// Дорожный маршрут через OpenRouteService потому что яндекс не доступен
	try {
		const orsKey = '5b3ce3597851110001cf62487012e46b44ac40f180c90c6d0c4b4098';

		// Форматируем координаты для OpenRouteService (долгота, широта)
		const start = `${coordinates[0]},${coordinates[1]}`;
		const end = `${nearestMKADPoint[0]},${nearestMKADPoint[1]}`;

		// Добавляем параметры для увеличения радиуса поиска и другие настройки
		const orsUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${start}&end=${end}&radiuses=1000,1000&continue_straight=false`;

		const routeRes = await fetch(orsUrl);

		if (!routeRes.ok) {
			const errorText = await routeRes.text();
			throw new Error(`HTTP error! status: ${routeRes.status}, body: ${errorText}`);
		}

		const routeData = await routeRes.json();

		if (!routeData.features || !routeData.features[0]) {
			throw new Error('Нет данных о маршруте в ответе');
		}

		let routeCoords = routeData.features[0].geometry.coordinates;

		const mkadPolygonTurf = turf.polygon([MKAD_COORDINATES]);

		let entryIndex = routeCoords.findIndex(coord =>
			booleanPointInPolygon(turf.point(coord), mkadPolygonTurf)
		);

		if (entryIndex !== -1 && entryIndex > 0) {
			const sliced = lineSlice(
				point(routeCoords[0]),
				point(routeCoords[entryIndex]),
				lineString(routeCoords)
			);
			routeCoords = sliced.geometry.coordinates;
		}

		const roadLine = {
			geometry: {
				type: 'LineString',
				coordinates: routeCoords,
			},
			style: {
				stroke: [{ color: '#1602f2', width: 3, opacity: 1 }]
			}
		};

		roadLineFeature.value = roadLine;
	} catch (err) {
		console.error('Подробная ошибка OpenRouteService:', err);
		alert(`Ошибка при построении маршрута по дороге: ${err.message}`);
	}

	// прямая линия
	airLineFeature.value = airLine;

	mapStore.setClick({
		coordinates,
		address,
		distance: minDistanceToMKAD
	});

	alert(`Адрес: ${address}, Прямое расстояние до МКАД: ${minDistanceToMKAD} м`);
};

const MKAD_COORDINATES = [
	[37.60450638364524, 55.90562330002895],
	[37.62593416288106, 55.90053041099508],
	[37.663020703866124, 55.89589992911906],
	[37.69681066343029, 55.89404758095886],
	[37.72400746015267, 55.88478450797341],
	[37.7495559661646, 55.87134910785928],
	[37.78087348966311, 55.853273448531795],
	[37.81054272245115, 55.840290842733324],
	[37.83609122846308, 55.824056461162954],
	[37.840211955239205, 55.80270949403583],
	[37.841860245949654, 55.7776350044597],
	[37.84268439130488, 55.75161470575466],
	[37.840211955239205, 55.727902472587026],
	[37.835267083107865, 55.707433231603936],
	[37.830322210976526, 55.68555645895682],
	[37.838563664528756, 55.66133804025885],
	[37.821256612069064, 55.64176601685536],
	[37.79818054212281, 55.62638110510047],
	[37.7701596000452, 55.6123895564569],
	[37.72565575086312, 55.59092610694302],
	[37.67785532026015, 55.575054237087215],
	[37.616044418618365, 55.57458731981772],
	[37.560002534463166, 55.58392460586524],
	[37.5196194120572, 55.59279296206207],
	[37.49819163282139, 55.6053919013764],
	[37.48088458036169, 55.620318716419696],
	[37.46522581861244, 55.63384121392584],
	[37.44544633008707, 55.65015522995738],
	[37.4289634229826, 55.66553076710199],
	[37.414952951943796, 55.68509086211261],
	[37.40341491697067, 55.69952177575652],
	[37.38693200986619, 55.71255155184052],
	[37.38116299237963, 55.72325131831278],
	[37.37621812024828, 55.733948141368685],
	[37.368800812051276, 55.753009092440124],
	[37.368800812051276, 55.76695020638278],
	[37.37209739347217, 55.78785249398001],
	[37.378690556313956, 55.79574598395746],
	[37.38775615522142, 55.80967175360064],
	[37.39270102735276, 55.828231666429616],
	[37.39517346341843, 55.840754582211844],
	[37.39187688199753, 55.85049182815483],
	[37.39682175412888, 55.85837256661292],
	[37.40753564374678, 55.867641968872086],
	[37.42813927762737, 55.87829903568916],
	[37.44544633008707, 55.88385807855089],
	[37.47676385358557, 55.886637300202985],
	[37.495719196755715, 55.89080575798008],
	[37.517971121346754, 55.90238244834193],
	[37.53857475522735, 55.908400956466835],
	[37.569892278725845, 55.91164130314611],
	[37.60450638364524, 55.90562330002895],
];

// Создаем полигон с помощью Turf.js
const mkadPolygon = turf.polygon([MKAD_COORDINATES]);

// Создаем второй полигон на 5км больше
const buffer = turf.buffer(mkadPolygon, 5, { units: 'kilometers' });

// Получаем координаты внешнего кольца второго полигона
const PODMOSKOVIE_COORDINATES = buffer.geometry.coordinates[0];

</script>

<style scoped>
@import "tailwindcss";
</style>
