import { Euler, PerspectiveCamera, Quaternion, Vector3 } from "three";

export type UiCameraParams = {
	rotx: number,
	roty: number,
	rotz: number,
	translatex: number,
	translatey: number,
	zoom: number
}

export function updateItemCamera(cam: PerspectiveCamera, imgwidth: number, imgheight: number, centery: number, params: UiCameraParams) {
	//fov such that the value 32 ends up in the projection matrix.yy
	//not sure if coincidence that this is equal to height
	cam.fov = Math.atan(1 / 32) / (Math.PI / 180) * 2;
	cam.aspect = imgwidth / imgheight;
	cam.updateProjectionMatrix();

	let rot = new Quaternion().setFromEuler(new Euler(
		-params.rotx / 2048 * 2 * Math.PI,
		params.roty / 2048 * 2 * Math.PI,
		-params.rotz / 2048 * 2 * Math.PI,
		"ZYX"
	));
	let pos = new Vector3(
		6,//no clue where the 6 comes from
		0,
		4 * -params.zoom
	);
	let quatx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), params.rotx / 2048 * 2 * Math.PI);
	let quaty = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -params.roty / 2048 * 2 * Math.PI);
	let quatz = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -params.rotz / 2048 * 2 * Math.PI)
	pos.applyQuaternion(quatx);
	pos.add(new Vector3(
		-params.translatex * 4,
		params.translatey * 4,
		-params.translatey * 4//yep this is y not z, i don't fucking know
	));
	pos.applyQuaternion(quaty);
	pos.applyQuaternion(quatz);
	pos.y += centery;
	pos.divideScalar(512);
	pos.z = -pos.z;

	cam.position.copy(pos);
	cam.quaternion.copy(rot);
	cam.updateProjectionMatrix();
	cam.updateMatrixWorld(true);
	return cam;
}
