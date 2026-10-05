import { useState, useEffect } from "react";

import PhotoAlbum from "react-photo-album";
import Lightbox from "yet-another-react-lightbox";
import OpenAI from "openai";

import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import styled from "styled-components";

import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";

import { BASE_URL, TOKEN_KEY } from "../constants";
import axios from "axios";

import { message } from "antd";
import { CircularProgress } from "@mui/material";

const Overlay = styled.div`
 position: fixed;
 top: 0;
 left: 0;
 width: 100%;
 height: 100%;
 background-color: rgba(0, 0, 0, 0.5);
 display: flex;
 justify-content: center;
 align-items: center;
 z-index: 1000;
`;

const MainContainer = styled.div`
 background-color: #27272a;
 height: 100%;
 min-height: 100vh;
`;

const HeaderContainer = styled.div`
 display: flex;
 flex-direction: column;
 align-items: center;
`;

const Landing = (props) => {
 const [index, setIndex] = useState(-1);
 const [inputValue, setInputValue] = useState("");
 const [isGeneratingImage, setIsGeneratingImage] = useState(false);
 const [generatedImageUrl, setGeneratedImageUrl] = useState();
 const [slicedPhotos, setSlicedPhotos] = useState();

 const openai = new OpenAI({
   apiKey: process.env.REACT_APP_OPENAI_KEY,
   dangerouslyAllowBrowser: true,
 });

 useEffect(() => {
   if (Boolean(generatedImageUrl)) {
     setSlicedPhotos([
       {
         src: generatedImageUrl,
         width: 200,
         height: 200,
       },
     ]);
   }
 }, [generatedImageUrl]);

 const createImage = async () => {
   try {
     setIsGeneratingImage(true);

     const repsonse = await openai.images.generate({
       model: "gpt-image-2",
       prompt: inputValue,
       n: 1,
       size: "1024x1024",
     });

     const imageBase64 = repsonse.data[0].b64_json;
     const image_url = `data:image/png;base64,${imageBase64}`;
     setGeneratedImageUrl(image_url);
   } catch (err) {
     message.error("soemthign went wrong");
   } finally {
     setIsGeneratingImage(false);
   }
 };

 const handleInputChange = (event) => {
   setInputValue(event.target.value);
 };

 const handleUploadImage = () => {
   fetch(generatedImageUrl)
     .then((response) => response.blob())
     .then((blob) => {
       let formData = new FormData();
       formData.append("message", "AI generated image");
       const file = new File([blob], "upload.jpg", {
         type: "image/jpg",
       });
       formData.append("media_file", file);

       const opt = {
         method: "POST",
         url: `${BASE_URL}/upload`,
         headers: {
           Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
         },
         data: formData,
       };

       axios(opt)
         .then((res) => {
           if (res.status === 200) {
             message.success("image/video uploaded successfully");
           }
         })
         .catch(() => {
           message.error("uplaod failed");
         })
         .finally(() => {
           setIndex(-1);
         });
     });
 };

 return (
   <MainContainer>
     {isGeneratingImage && (
       <Overlay>
         <CircularProgress color="info" size={80} />
       </Overlay>
     )}

     <HeaderContainer>
       <Typography
         variant="h1"
         fontSize="5.2rem"
         noWrap
         component="div"
         sx={{
           marginTop: "128px",
           fontFamily: "Roboto",
           color: "white",
           textDecoration: "none",
         }}
       >
         Social AI
       </Typography>
       <Typography
         variant="h5"
         fontSize="1.2rem"
         component="div"
         sx={{
           mr: 2,
           fontFamily: "Roboto",
           color: "white",
           textDecoration: "none",
           margin: "0 20px",
           textAlign: "center",
         }}
       >
         Unleash Creativity, Share Memories—Where AI Meets Your Imagination!
       </Typography>

       <Paper
         component="form"
         sx={{
           p: "2px 4px",
           display: "flex",
           alignItems: "center",
           width: "80%",
           maxWidth: "600px",
           borderRadius: "10px",
           marginTop: "32px",
           marginBottom: "64px",
         }}
       >
         <InputBase
           multiline
           sx={{ ml: 1, flex: 1 }}
           placeholder="enter your description here"
           value={inputValue}
           onChange={handleInputChange}
         />

         <IconButton type="button" sx={{ p: "10px" }} onClick={createImage}>
           <ArrowForwardIcon />
         </IconButton>
       </Paper>
     </HeaderContainer>

     <PhotoAlbum
       photos={slicedPhotos}
       layout="rows"
       targetRowHeight={200}
       onClick={({ index }) => setIndex(index)}
     />

     <Lightbox
       slides={slicedPhotos}
       open={index >= 0}
       index={index}
       close={() => setIndex(-1)}
       toolbar={{
         buttons: [
           <IconButton
             key="uplaod"
             type="button"
             sx={{ p: "10px" }}
             onClick={handleUploadImage}
           >
             <FileUploadRoundedIcon sx={{ color: "white" }} />
           </IconButton>,
         ],
       }}
       plugins={[Fullscreen, Slideshow, Thumbnails, Zoom]}
     />
   </MainContainer>
 );
};

export default Landing;
