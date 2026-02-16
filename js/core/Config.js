export const CONFIG = {
    // Water Simulation
    WATER_GRID_SIZE: 256, // resolution of the water surface simulation
    WATER_DAMPING: 0.995, // how quickly waves lose energy

    // Caustics Shaders
    CAUSTIC_TIME_FREQ: 0.5, // speed of the underwater light pattern animation
    CAUSTIC_TAU: 6.2831853, // 2 * PI
    CAUSTIC_CELL_SCALE: 6.0, // frequency/density of the caustic cells
    CAUSTIC_LIGHT_SHIFT: 0.15, // how much the caustics shift with light direction
    CAUSTIC_NORMAL_SHIFT: 0.2, // how much waves distort the caustic pattern
    CAUSTIC_POWER: 4, // sharpness of the light rays
    CAUSTIC_INTENSITY: 0.4, // overall brightness of caustics

    // Lighting & Rendering
    SPECULAR_POWER: 80.0, // shininess of the water surface
    NORMAL_AMPLIFICATION: 12.0, // visual steepness of the ripples
    SUN_Z: 0.4, // default elevation of the sun light

    // Leaf Physics
    LEAF_WAVE_FORCE: 800.0, // how strongly water movement pushes leaves
    LEAF_GRAVITY: 5.0, // slight downward drift speed
    LEAF_DRAG: 0.98, // linear velocity decay
    LEAF_TORQUE_SCALE: 0.4, // how much velocity affects leaf spin
    LEAF_ROTATIONAL_FRICTION: 0.92, // how quickly spin slows down
    LEAF_MAX_SPIN: 6.0, // maximum angular velocity

    // Game Mechanics
    LEAF_SPAWN_INTERVAL_BASE: 1.8, // minimum time between new leaves
    LEAF_SPAWN_INTERVAL_VAR: 2.5, // random variance added to spawn interval
    COMBO_TIMEOUT: 3.0, // seconds until combo resets
    COLLECTION_ZONE_RATIO: 0.1, // percentage of screen height for collection area
    COLLECTION_ZONE_MIN: 60.0, // minimum height of collection area in pixels

    // Leaf Visuals
    LEAF_SHADOW_OFFSET_SCALE: 40.0, // how much sun angle affects shadow distance
    LEAF_STEM_LENGTH: 0.4, // length of stem relative to leaf size
    LEAF_BUMP_INTENSITY: 0.3 // how much sun angle affects shading
};