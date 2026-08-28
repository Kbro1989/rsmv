import { SovereignThickSubstrateParser } from '../viewer/SovereignThickSubstrateParser';
import { parseThickModelData } from '../3d/rt7model';
import chalk from 'chalk';

const GRASS_SUBSTRATE = {
  "maxy": 352,
  "miny": 0,
  "bonecount": 0,
  "skincount": 0,
  "meshdata": {
    "vertexCount": 338,
    "positionBuffer": "buffer short[3][]{-8,168,-152,-32,168,-124,-52,0,-144,-32,0,-172,12,352,-108}",
    "renders": [
      {
        "isHidden": false,
        "materialArgument": 1,
        "buf": "buffer ushort[]{0,1,2,3,4,5}"
      }
    ]
  }
};

async function verify() {
  console.log(chalk.bold.cyan('\n--- Sovereign Thick Substrate Verification ---'));
  
  try {
    const materialized = SovereignThickSubstrateParser.materializeModelSubstrate(GRASS_SUBSTRATE);
    console.log(chalk.green('SUCCESS: Materialized string buffers to TypedArrays.'));
    
    console.log('Position Buffer:', materialized.meshdata.positionBuffer);
    console.log('Index Buffer (Render 0):', materialized.meshdata.renders[0].buf);

    const modelData = parseThickModelData(materialized);
    console.log(chalk.green('SUCCESS: Generated Three.js-ready ModelData.'));
    console.log('Mesh Count:', modelData.meshes.length);
    console.log('Vertex Start (Mesh 0):', modelData.meshes[0].vertexstart);
    console.log('Vertex End (Mesh 0):', modelData.meshes[0].vertexend);

  } catch (err: any) {
    console.error(chalk.red('Verification failed:'), err.message);
    process.exit(1);
  }
}

verify();
