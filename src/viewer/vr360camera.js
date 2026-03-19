"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VR360Render = void 0;
const three_1 = require("three");
class EquirectangularMaterial extends three_1.RawShaderMaterial {
    transparent = true;
    constructor() {
        super({
            //TODO check if typings are wrong here
            //@ts-ignore
            uniforms: { map: { type: 't', value: null } },
            vertexShader: `
				attribute vec3 position;
				varying vec2 vUv;
				void main()  {
					vUv = vec2(position.x,position.y);
					gl_Position = vec4(position, 1.0);
				}`,
            fragmentShader: `
				precision mediump float;
				uniform samplerCube map;
				varying vec2 vUv;
				#define M_PI 3.1415926535897932384626433832795
				void main() {
					float longitude = vUv.x * M_PI;
					float latitude = vUv.y * 0.5 * M_PI;
					vec3 dir = vec3(sin(longitude) * cos(latitude), sin(latitude), -cos(longitude) * cos(latitude));
					normalize(dir);
					gl_FragColor = textureCube(map, dir);
				}`,
            side: three_1.DoubleSide,
            transparent: true
        });
    }
}
class VR360Render {
    cubeRenderTarget;
    cubeCamera;
    skyCubeCamera;
    quad;
    projectCamera;
    size;
    constructor(parent, size, near, far) {
        this.size = size;
        let gl = parent.getContext();
        this.cubeRenderTarget = new three_1.WebGLCubeRenderTarget(size, {
            minFilter: three_1.LinearFilter,
            magFilter: three_1.LinearFilter,
            format: three_1.RGBAFormat,
            colorSpace: parent.outputColorSpace,
            samples: 0 //gl.getParameter(gl.SAMPLES)//three.js crashes if using multisampled here
        });
        //threejs always renders non-default render targets in linear, however they programmed in a 
        //special case for webxr render targets to still render in srgb
        //i'm guessing you would normally want your cubemaps to be linear for correct light calcs in reflection
        //but in this case the cube is the output
        //i could do this without hack by doing srgb in the fragment shader but that would result in big loss
        //of quality since we're in 8bit colors already
        this.cubeRenderTarget.isXRRenderTarget = true;
        this.cubeCamera = new three_1.CubeCamera(near, far, this.cubeRenderTarget);
        this.skyCubeCamera = new three_1.CubeCamera(near, far, this.cubeRenderTarget);
        this.quad = new three_1.Mesh(new three_1.PlaneGeometry(2, 2), new EquirectangularMaterial());
        this.quad.frustumCulled = false;
        this.projectCamera = new three_1.Camera();
    }
    render(renderer) {
        this.quad.material.uniforms.map.value = this.cubeCamera.renderTarget.texture;
        // renderer.setSize(this.size * 2, this.size);
        renderer.render(this.quad, this.projectCamera);
    }
}
exports.VR360Render = VR360Render;
