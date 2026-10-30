import {
  FaDog,
  FaFish,
  FaLeaf,
  FaUtensils,
  FaRestroom,
  FaMonument,
  FaWater,
  FaTree,
  FaMapMarkerAlt,
  FaDoorOpen,
  FaChild,
  FaFlask
} from "react-icons/fa";
import { TbBuildingChurch } from "react-icons/tb"; // Better temple icon
import { GiPenguin, GiTigerHead, GiMonkey, GiHummingbird} from "react-icons/gi";
import { HiOutlineBuildingOffice2 } from "react-icons/hi2";
import { PiBird } from "react-icons/pi";


export const categoryIconMap = {
  entry: FaDoorOpen,
  animal: FaDog,         // default for animal category
  penguin: GiPenguin,
  tiger: GiTigerHead,
  monkey: GiMonkey,
  bird: GiHummingbird,
  food: FaUtensils,
  flower: FaLeaf,
  heritage: TbBuildingChurch,
  water: FaWater,
  toilet: FaRestroom,
  building: HiOutlineBuildingOffice2,
  recreation:FaChild,
  birds:PiBird ,
  test: FaFlask, // 🧪 dev/test exhibits
};


export const idSpecificIcons = {
  penguin: GiPenguin,
  tiger: GiTigerHead,
  monkey: GiMonkey,
  RoseGarden: FaLeaf,
  dev_start: FaMapMarkerAlt,
  dev_end: FaMapMarkerAlt,
};
