export function createWorldCollision({ terrainHeightAt }) {
  const colliders = [];
  const platforms = [];
  const terrainAreas = [];

  function toArea(x, z, width, depth, top) {
    return {
      minx: x - width / 2,
      maxx: x + width / 2,
      minz: z - depth / 2,
      maxz: z + depth / 2,
      top,
    };
  }

  function addCollider(x, z, width, depth, bottom = 0, top = 3.2) {
    colliders.push({
      minx: x - width / 2,
      maxx: x + width / 2,
      minz: z - depth / 2,
      maxz: z + depth / 2,
      bottom,
      top,
    });
  }

  function addTerrainArea(x, z, width, depth, top) {
    terrainAreas.push(toArea(x, z, width, depth, top));
  }

  function addPlatform(x, z, width, depth, top) {
    platforms.push(toArea(x, z, width, depth, top));
  }

  function addPlatformBounds(minx, maxx, minz, maxz, top) {
    platforms.push({ minx, maxx, minz, maxz, top });
  }

  function terrainYAt(x, z) {
    let top = terrainHeightAt(x, z);
    for (const area of terrainAreas) {
      if (x >= area.minx && x <= area.maxx && z >= area.minz && z <= area.maxz) {
        top = Math.max(top, area.top);
      }
    }
    return top;
  }

  function groundHeightAt(x, z) {
    let ground = terrainHeightAt(x, z);
    for (const platform of platforms) {
      if (x >= platform.minx && x <= platform.maxx && z >= platform.minz && z <= platform.maxz) {
        if (platform.top > ground) ground = platform.top;
      }
    }
    return ground;
  }

  function resolveCollision(player, playerRadius) {
    for (let index = 0; index < colliders.length; index += 1) {
      const collider = colliders[index];
      const platform = platforms.find(candidate =>
        Math.abs((candidate.minx + candidate.maxx) / 2 - (collider.minx + collider.maxx) / 2) < 0.01
        && Math.abs((candidate.minz + candidate.maxz) / 2 - (collider.minz + collider.maxz) / 2) < 0.01
      );
      if (platform && player.y >= platform.top - 0.05) continue;
      const closestX = Math.max(collider.minx, Math.min(player.x, collider.maxx));
      const closestZ = Math.max(collider.minz, Math.min(player.z, collider.maxz));
      const dx = player.x - closestX;
      const dz = player.z - closestZ;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared < playerRadius * playerRadius) {
        const distance = Math.sqrt(distanceSquared);
        if (distance > 0.0001) {
          const push = (playerRadius - distance) / distance;
          player.x += dx * push;
          player.z += dz * push;
        } else {
          const toLeft = player.x - collider.minx;
          const toRight = collider.maxx - player.x;
          const toDown = player.z - collider.minz;
          const toUp = collider.maxz - player.z;
          const nearest = Math.min(toLeft, toRight, toDown, toUp);
          if (nearest === toLeft) player.x = collider.minx - playerRadius;
          else if (nearest === toRight) player.x = collider.maxx + playerRadius;
          else if (nearest === toDown) player.z = collider.minz - playerRadius;
          else player.z = collider.maxz + playerRadius;
        }
      }
    }
  }

  return {
    colliders,
    platforms,
    terrainAreas,
    addCollider,
    addTerrainArea,
    addPlatform,
    addPlatformBounds,
    terrainYAt,
    groundHeightAt,
    resolveCollision,
  };
}
