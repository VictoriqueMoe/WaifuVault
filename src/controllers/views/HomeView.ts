import { Get, Hidden, Required, View } from "@tsed/schema";
import { constant, Controller, Inject } from "@tsed/di";
import { PathParams, Req, Res } from "@tsed/common";
import CaptchaServices from "../../model/constants/CaptchaServices.js";
import { CaptchaManager } from "../../manager/CaptchaManager.js";
import type { Request, Response } from "express";
import { BucketSessionService } from "../../services/BucketSessionService.js";
import { AlbumService } from "../../services/AlbumService.js";
import { PublicAlbumDto } from "../../model/dto/PublicAlbumDto.js";
import { NotFound } from "@tsed/exceptions";
import GlobalEnv from "../../model/constants/GlobalEnv.js";

@Controller("/")
@Hidden()
export class HomeView {
    public constructor(
        @Inject() private captchaManager: CaptchaManager,
        @Inject() private bucketSessionService: BucketSessionService,
        @Inject() private albumService: AlbumService,
    ) {}

    @Get()
    @View("index.ejs")
    public showRoot(): unknown {
        return null;
    }

    @Get("/bucketAccess")
    @View("bucketAccess.ejs")
    public showBucketLoginPage(@Res() res: Response): unknown {
        if (this.bucketSessionService.hasActiveSession()) {
            res.redirect("/admin/bucket");
        }
        const captchaType = this.activeCaptchaService;
        return {
            captchaType,
        };
    }

    @Get("/login")
    @View("login.ejs")
    public showLogin(@Req() req: Request, @Res() res: Response): unknown {
        if (req.user) {
            res.redirect("/admin/stats");
        }
        const captchaType = this.activeCaptchaService;
        return {
            captchaType,
        };
    }

    @Get("/album/:publicToken")
    @View("album.ejs")
    public async showAlbum(@PathParams("publicToken") @Required() publicToken: string): Promise<unknown> {
        const albumExists = await this.albumService.albumExists(publicToken);
        if (!albumExists) {
            throw new NotFound("Album does not exist");
        }
        const baseUrl = constant(GlobalEnv.BASE_URL) as string;
        const album = await this.albumService.getAlbum(publicToken);
        const dto = PublicAlbumDto.fromModel(album);
        const thumbs = dto.files.filter(f => f.metadata.thumbnail).map(x => x.metadata.thumbnail ?? "");
        const albumThumb = thumbs.length > 0 ? thumbs[0] : `${baseUrl}/assets/custom/images/albumNoImage.png`;
        return {
            publicToken,
            albumThumb,
        };
    }

    private get activeCaptchaService(): CaptchaServices | null {
        return this.captchaManager.engine?.type ?? null;
    }
}
